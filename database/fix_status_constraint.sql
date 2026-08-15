-- 1. Safely migrate/map any old or incorrectly formatted status values to our exact intended vocabulary
UPDATE public_chanda_requests SET status = 'PENDING_REVIEW' WHERE UPPER(status) IN ('PENDING', 'PENDING_PAYMENT');
UPDATE public_chanda_requests SET status = 'ACCEPTED' WHERE UPPER(status) IN ('APPROVED', 'ACCEPTED', 'PAID', 'SUCCESS');
UPDATE public_chanda_requests SET status = 'REJECTED' WHERE UPPER(status) IN ('REJECT', 'REJECTED', 'FAILED');

-- 2. Drop the restrictive or mismatched old constraint
ALTER TABLE public_chanda_requests DROP CONSTRAINT IF EXISTS public_chanda_requests_status_check;

-- 3. Apply the exact strict Business Rules constraint
ALTER TABLE public_chanda_requests ADD CONSTRAINT public_chanda_requests_status_check 
CHECK (status IN ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED'));

-- 4. Reload PostgREST Cache natively just to be safe
NOTIFY pgrst, 'reload schema';
