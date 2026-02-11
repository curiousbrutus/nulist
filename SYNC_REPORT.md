# Zimbra Sync Report

**Date:** 2024-05-24
**Status:** Partial Success

## Summary
- **Total Tasks Synced:** 68
- **Failed Tasks:** 7
- **Reason for Failures:** Permission denied (Zimbra access rights)

## Failed Users & Error Details
The following users have tasks that could not be synced to Zimbra because the current system account (`sekreterlik` or Admin) does not have write permissions for their calendars/tasks.

### 1. Merve Ağdağlı (merveagdagli@optimed.com.tr)
- **Error:** `permission denied: can not access account merveagdagli@optimed.com.tr`
- **Missing Tasks:**
  - "AACI belgesinin 19 Mart'a kadar yenilenmemesi üzerine..."
  - "Acil müdehale odasının da dışardan görünmemesi..."

### 2. Nagihan Avcı (nagihanavci@optimed.com.tr)
- **Error:** `permission denied: can not access account nagihanavci@optimed.com.tr`
- **Missing Tasks:**
  - "Depo malzemelerinin yeni ofislerin ön girişindeki boş depoya taşınması..."

### 3. Elçin Esen Eşiyok (elcinesenesiyok@optimed.com.tr)
- **Error:** `permission denied: can not access account elcinesenesiyok@optimed.com.tr`
- **Missing Tasks:**
  - "Gece temizliği ve personel planlamasının düzenlenmesi"

### 4. Arzu Ceren Tuna (arzucerentuna@optimed.com.tr)
- **Error:** `permission denied: can not access account arzucerentuna@optimed.com.tr`
- **Missing Tasks:**
  - "Acilin para kaybı ve işleyişte revizyona gidilmesi"

## Action Required
Please ensure that the "Secretary" or "Admin" account currently configured in `.env` (used for API access) has **Delegated Auth** or **Shared Folder Write** permissions on the mailboxes of the users listed above.
