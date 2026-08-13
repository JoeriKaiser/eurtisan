-- Removes the food categories.
--
-- Eurtisan does not sell food, but the taxonomy said otherwise: `Food & Drink`
-- was a root category with `Preserves`, `Honey`, and `Spices` beneath it.
--
-- That mattered legally, not just cosmetically. Regulation (EU) 1169/2011
-- Article 14(1)(a) requires every mandatory particular for prepacked food sold
-- at a distance — ingredients, allergens, net quantity, storage conditions, the
-- food business operator's name and address — to be available *before the
-- purchase is concluded*, and the `product` model has no field for any of them.
-- A seller listing honey could not have complied, and the platform gave them no
-- way to.
--
-- Fails rather than orphaning: `product.category_id` is ON DELETE SET NULL, so
-- deleting these categories would leave any live food listing published and
-- uncategorised. If a deployment actually has one, a human decides.
DO $$
DECLARE
  published_count int;
BEGIN
  SELECT count(*) INTO published_count
  FROM "product" p
  JOIN "category" c ON c.id = p.category_id
  WHERE (c.name = 'Food & Drink' OR c.parent_id IN (SELECT id FROM "category" WHERE name = 'Food & Drink'))
    AND p.status = 'published';

  IF published_count > 0 THEN
    RAISE EXCEPTION 'Cannot remove food categories: % published product(s) still use them', published_count
      USING HINT = 'Reassign or unpublish those listings first, then re-run the migration.';
  END IF;
END $$;--> statement-breakpoint
DELETE FROM "category" WHERE "parent_id" IN (SELECT id FROM "category" WHERE "name" = 'Food & Drink');--> statement-breakpoint
DELETE FROM "category" WHERE "name" = 'Food & Drink';
