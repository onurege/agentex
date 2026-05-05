-- AlterTable
ALTER TABLE "BoardRun" ADD COLUMN     "clientParty" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "stance" TEXT NOT NULL DEFAULT 'objective';
