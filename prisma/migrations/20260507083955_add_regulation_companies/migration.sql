-- AlterTable
ALTER TABLE "RegulationItem" ADD COLUMN     "companies" TEXT[] DEFAULT ARRAY[]::TEXT[];
