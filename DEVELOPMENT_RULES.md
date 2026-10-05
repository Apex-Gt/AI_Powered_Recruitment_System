# DEVELOPMENT RULES

## GENERAL

1. Use Java 21.
2. Use Spring Boot.
3. Use PostgreSQL.
4. Use UUID for entity IDs.
5. Use Spring Data JPA.
6. Use MapStruct.
7. Use DTOs at API boundaries.
8. Keep Controller → Service → Repository architecture.
9. Keep business logic inside Services.
10. Keep database access inside Repositories.

---

## SECURITY

11. Never trust client-provided companyId.

12. Never trust client-provided role.

13. Never trust client-provided createdBy.

14. Never trust client-provided verification flags.

15. Ownership must come from the authenticated user.

16. Passwords must always be BCrypt encoded.

17. Never put passwords or password hashes into JWT.

18. Never log passwords.

19. Never expose passwords in response DTOs.

20. Backend authorization is mandatory.

---

## COMPANY ISOLATION

21. A recruiter cannot access another company's data.

22. An ADMIN can access only their own company's data.

23. Every company-owned entity must have a clear company ownership path.

24. Query authorization must be enforced at service/repository level.

25. Never rely only on frontend filtering.

---

## DTOs

26. Request DTOs should contain only client-controlled information.

27. Backend-controlled fields must be assigned by the service.

28. Do not add companyId to recruiter/job creation requests if it can be derived from authentication.

29. Do not add role to recruiter creation requests.

30. Do not expose JPA entities unnecessarily.

---

## MAPSTRUCT

31. Use MapStruct for DTO/entity mapping.

32. Ignore backend-controlled fields when mapping requests.

Typical ignored fields:

- id
- role
- company
- password
- createdAt
- updatedAt
- emailVerified
- phoneNumberVerified

Password encoding must happen in the service.

---

## AUTHENTICATION

33. Use existing AuthService/AuthController for login.

34. Do not create separate login logic for ADMIN and RECRUITER.

35. ADMIN and RECRUITER are both User records.

36. Role determines authorization.

---

## COMPANY

37. Use Company terminology everywhere.

38. Do not use Organization.

39. Company registration creates the company and first ADMIN.

40. Company registration must be transactional.

41. companyVerified is controlled by the platform verification process.

---

## RECRUITER

42. Recruiter is a User with role RECRUITER.

43. Recruiter belongs to exactly one company.

44. Recruiter creation is performed by ADMIN.

45. Recruiter company is derived from authenticated ADMIN.

---

## JOB

46. Job belongs to a company.

47. Job records who created it.

48. createdBy must be derived from authentication.

49. companyId must be derived from authentication.

---

## DATABASE

50. Important uniqueness rules must exist at database level.

51. Service-level duplicate checks are for friendly error messages.

52. Repository method names must exactly match entity properties.

Example:

Entity:
email

Correct:

existsByEmail()

Not:

existsByCompanyEmail()

unless the entity actually has companyEmail.

---

## CODE CHANGES

53. Inspect existing implementation before writing code.

54. Do not rewrite unrelated code.

55. Do not introduce unnecessary abstractions.

56. Reuse existing services/repositories where appropriate.

57. Follow existing package structure.

58. Preserve existing API contracts unless the task requires a change.

---

## WHEN IMPLEMENTING A FEATURE

Always provide:

1. Files to create.
2. Files to modify.
3. Entity changes.
4. DTO changes.
5. Repository changes.
6. Service changes.
7. Controller changes.
8. Security implications.
9. Database changes.
10. Postman testing steps.

---

## WHEN SOMETHING IS UNCLEAR

Do not invent project behavior.

Say:

"Not currently defined in the project context."

Then ask for the required information.

---

## AFTER COMPLETING A TASK

Report:

- What changed
- Files changed
- Why
- API endpoint
- Request example
- Expected response
- Database changes
- Testing steps
- Remaining work

Then update CURRENT_STATE.md.