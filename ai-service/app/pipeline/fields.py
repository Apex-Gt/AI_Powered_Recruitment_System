"""Deterministic field extraction: things a regex can read exactly, so the LLM never has to (and cannot invent them)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from app.services.contact_extractor import EMAIL_RE, _first_phone, _name_from_filename, _name_from_header

_URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>()\[\]\"']+", re.IGNORECASE)
_BARE_LINK_RE = re.compile(r"\b(?:linkedin\.com/in|github\.com)/[A-Za-z0-9_\-./]+", re.IGNORECASE)
_TRAILING = ".,;:)"


@dataclass
class ContactFields:
    name: Optional[str] = None
    email: Optional[str] = None
    emails: list[str] = field(default_factory=list)
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "email": self.email,
            "emails": self.emails,
            "phone": self.phone,
            "linkedinUrl": self.linkedin_url,
            "githubUrl": self.github_url,
            "portfolioUrl": self.portfolio_url,
        }


def _clean_url(url: str) -> str:
    url = url.rstrip(_TRAILING)
    return url if url.lower().startswith("http") else f"https://{url}"


def extract_urls(text: str) -> list[str]:
    found = [_clean_url(m.group(0)) for m in _URL_RE.finditer(text)]
    found += [_clean_url(m.group(0)) for m in _BARE_LINK_RE.finditer(text)]
    seen: set[str] = set()
    unique = []
    for url in found:
        key = url.lower().rstrip("/")
        if key not in seen and "@" not in url:
            seen.add(key)
            unique.append(url)
    return unique


def extract_contact_fields(text: str, file_name: str = "") -> ContactFields:
    """Read name/email/phone/links from the resume header. The first email in the header wins."""
    head = text[:4000]
    emails: list[str] = []
    for match in EMAIL_RE.finditer(text):
        email = match.group(0).lower().rstrip(_TRAILING)
        if email not in emails:
            emails.append(email)
    header_email = next((e for e in emails if e in head.lower()), None)

    fields = ContactFields(
        name=_name_from_header(text) or None,
        email=header_email or (emails[0] if emails else None),
        emails=emails[:5],
        phone=_first_phone(head),
    )
    for url in extract_urls(text):
        lowered = url.lower()
        if "linkedin.com" in lowered and not fields.linkedin_url:
            fields.linkedin_url = url
        elif "github.com" in lowered and not fields.github_url:
            fields.github_url = url
        elif not fields.portfolio_url and not any(s in lowered for s in ("linkedin.com", "github.com")):
            fields.portfolio_url = url
    if not fields.name and file_name:
        guess = _name_from_filename(file_name)
        fields.name = guess if guess != "Unknown candidate" else None
    return fields
