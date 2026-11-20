# NEXUS Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: All unmatched paths are strictly denied.
2. **Verified Identity**: All mutations require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **No Self-Assigned Privileges**: Users creating `/users/{userId}` can only assign `role: "member"` unless verified as bootstrapped admin (`ekeminiabasilouis@gmail.com` with `email_verified == true`) or already present in `/admins/{uid}`. Users cannot escalate `role` on update.
4. **Master Gate Integrity**: Subcollections (`/customers/{customerId}/interactions`, `/projects/{projectId}/tasks`, `/projects/{projectId}/comments`) verify parent existence and parent ownership via `get(...)` on `get`, `create`, `update`, and `delete`.
5. **Query Enforcer**: All `allow list` rules evaluate `resource.data.ownerId == request.auth.uid` (zero `get()` inside `list`).
6. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on `create` and remain immutable on `update`; `updatedAt` must equal `request.time` on `update`; `ownerId` is immutable.
7. **PII Isolation**: User emails/profiles under `/users/{userId}` and customer PII under `/customers/{customerId}` are readable strictly by the owner or verified admin.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Customer Read**: `GET /customers/cust-1` with `auth = null`.
2. **Unverified Email Write**: `CREATE /customers/cust-2` with `auth.token.email_verified = false`.
3. **Role Privilege Escalation**: `UPDATE /users/uid-1` changing `role` from `"member"` to `"admin"`.
4. **Cross-Tenant Customer Read**: `GET /customers/cust-other` where `resource.data.ownerId != auth.uid`.
5. **Blanket List Scraping**: `LIST /transactions` without `where("ownerId", "==", auth.uid)`.
6. **Shadow Field Injection**: `CREATE /transactions/tx-1` with extra field `isApprovedByServer: true`.
7. **Identity Spoofing on Create**: `CREATE /projects/proj-1` with `ownerId: "victim-uid"`.
8. **Owner Reassignment on Update**: `UPDATE /projects/proj-1` modifying `ownerId`.
9. **Client Timestamp Forgery**: `CREATE /transactions/tx-2` with `createdAt` set to a past client timestamp instead of `request.time`.
10. **Orphaned Subcollection Task**: `CREATE /projects/non-existent-id/tasks/task-1`.
11. **Oversized ID Poisoning**: `CREATE /customers/<150-char-invalid-id>` failing `isValidId()`.
12. **Negative Amount / Value Poisoning**: `CREATE /transactions/tx-3` with `amount: -500` or `type: "invalid"`.
