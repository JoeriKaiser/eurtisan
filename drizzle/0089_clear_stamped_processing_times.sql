-- 0088 briefly stamped every shop with 2-5 dispatch days. Product pages read
-- these columns before decrypting shippingOrigin, so invented values would
-- disagree with the seller-declared window. Leave the columns null until a
-- real origin write populates them; getProductBySlugQuery falls back to decrypt.
UPDATE "shop"
SET "processing_time_min_days" = NULL,
    "processing_time_max_days" = NULL
WHERE "processing_time_min_days" IS NOT NULL
   OR "processing_time_max_days" IS NOT NULL;
