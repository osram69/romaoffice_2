-- "Domiciliazione aggiuntiva" does not exist as a service for postal domiciliation — the
-- additional_domiciliation column defaulted to true for every service (including postal) when
-- it was first added, which incorrectly showed the option and made the discount computable for
-- postal orders. The application code (src/lib/pricing.ts) already refuses this discount for
-- postal regardless of this flag; this migration corrects the underlying data for consistency
-- (e.g. so the tariffs admin panel doesn't show it enabled for postal tiers).
UPDATE service_prices SET additional_domiciliation = false WHERE service = 'postal';
