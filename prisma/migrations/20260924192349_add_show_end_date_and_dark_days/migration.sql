-- AlterTable
ALTER TABLE "estimates" ADD COLUMN     "darkDays" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "showEndDate" TIMESTAMP(3);
