DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cap')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_fundamental')
  THEN
    ALTER TABLE "cap" RENAME TO "company_fundamental";
  END IF;
END $$;
