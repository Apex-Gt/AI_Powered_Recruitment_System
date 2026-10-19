"""Pulls the contact block (name, email, phone, location) out of a resume, synchronously."""

import re
from pathlib import Path
from typing import Optional

from app.core.logging import get_logger
from app.models.schemas import CandidateProfile
from app.services.llm import LLMService, get_llm_service
from app.services.pdf_processor import CandidateExtractionService

logger = get_logger(__name__)

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?<![\w/])(\+?\d[\d\s().\-]{8,17}\d)(?![\w/])")

_SYSTEM = "You extract contact details from resumes. Return only valid JSON."
_PROMPT = """From the start of this resume, extract the candidate's own contact details.
Return JSON: {{"name": string|null, "email": string|null, "phone": string|null, "location": string|null}}
- name: the candidate's full name as written, not a job title or company
- location: city (and state/country if given) where the candidate lives, null if absent
- use null for anything not explicitly present

Resume text:
{text}"""


def _first_email(text: str) -> Optional[str]:
    match = EMAIL_RE.search(text)
    return match.group(0).lower() if match else None


def _first_phone(text: str) -> Optional[str]:
    for match in PHONE_RE.finditer(text):
        raw = match.group(1).strip()
        digits = re.sub(r"\D", "", raw)
        if 10 <= len(digits) <= 15:
            return raw
    return None


def _name_from_header(text: str) -> Optional[str]:
    """Resumes almost always open with the name; take the first short line that looks like one."""
    for line in text.splitlines()[:12]:
        line = line.strip()
        if not line or "@" in line or any(ch.isdigit() for ch in line):
            continue
        words = line.split()
        if 2 <= len(words) <= 4 and all(re.fullmatch(r"[A-Za-z.'\-]+", w) for w in words):
            return " ".join(w.capitalize() if w.isupper() else w for w in words)
    return None


def _name_from_filename(file_name: str) -> str:
    stem = re.sub(r"[_\-.\d]+", " ", Path(file_name).stem)
    stem = re.sub(r"(?i)\b(resume|cv|curriculum|vitae)\b", " ", stem)
    stem = re.sub(r"\s+", " ", stem).strip()
    return stem.title() if stem else "Unknown candidate"


class ContactExtractionService:
    def __init__(self, llm: Optional[LLMService] = None):
        self._llm = llm

    @property
    def llm(self) -> LLMService:
        return self._llm or get_llm_service()

    async def extract(self, text: str, file_name: str = "", use_llm: bool = True) -> dict:
        head = text[:4000]
        found = {
            "name": None,
            "email": _first_email(head) or _first_email(text),
            "phone": _first_phone(head),
            "location": None,
        }

        if use_llm and self.llm.is_configured:
            try:
                data = await self.llm.chat_json(system=_SYSTEM, user=_PROMPT.format(text=head))
                for key in ("name", "location"):
                    value = data.get(key)
                    if isinstance(value, str) and value.strip():
                        found[key] = value.strip()[:200]
                # The regex result wins for email/phone (the model can mangle them); it only fills gaps.
                for key in ("email", "phone"):
                    value = data.get(key)
                    if not found[key] and isinstance(value, str) and value.strip():
                        found[key] = value.strip()
            except Exception as e:  # noqa: BLE001 - extraction must degrade, never fail the upload
                logger.warning("contact_llm_extraction_failed", error=str(e))

        found["name"] = found["name"] or _name_from_header(text) or _name_from_filename(file_name)
        return found

    async def extract_with_profile(self, text: str, file_name: str = "") -> tuple[dict, Optional[CandidateProfile]]:
        """One pass over the whole resume: the full profile is the source of truth for the contact fields.

        Email and phone from the model are only trusted when they really appear in the resume text, so a
        hallucinated address can never become the candidate's email.
        """
        profile: Optional[CandidateProfile] = None
        if self.llm.is_configured:
            try:
                profile = await CandidateExtractionService(self._llm).extract_candidate_profile(text)
            except Exception as e:  # noqa: BLE001 - fall back to the lighter extraction below
                logger.warning("full_profile_extraction_failed", error=str(e))

        found = await self.extract(text, file_name, use_llm=profile is None)
        if profile is None:
            return found, None

        found["name"] = profile.name.strip() or found["name"]
        found["location"] = (profile.location or "").strip() or found["location"]

        flat_text = text.lower()
        digits_text = re.sub(r"\D", "", text)
        if profile.email and str(profile.email).lower() in flat_text:
            found["email"] = str(profile.email).lower()
        if profile.phone and re.sub(r"\D", "", profile.phone) and re.sub(r"\D", "", profile.phone) in digits_text:
            found["phone"] = profile.phone.strip()
        return found, profile
