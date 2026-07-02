-- Drop old tables if they exist
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.news CASCADE;
DROP TABLE IF EXISTS public.cards CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.subscribers CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;

-- Create users table
CREATE TABLE public.users (
    "id" TEXT PRIMARY KEY,
    "email" TEXT UNIQUE NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordSalt" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT DEFAULT 'Subscriber',
    "bio" TEXT,
    "avatar" TEXT,
    "bookmarks" JSONB DEFAULT '[]',
    "likes" JSONB DEFAULT '[]',
    "history" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categories table
CREATE TABLE public.categories (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT
);

-- Create posts table
CREATE TABLE public.posts (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT UNIQUE NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "status" TEXT DEFAULT 'Draft',
    "featuredImage" TEXT,
    "author" TEXT,
    "authorName" TEXT,
    "categoryId" TEXT REFERENCES public.categories("id") ON DELETE SET NULL,
    "tags" TEXT[] DEFAULT '{}',
    "views" INTEGER DEFAULT 0,
    "likes" INTEGER DEFAULT 0,
    "claps" INTEGER DEFAULT 0,
    "readingTime" INTEGER DEFAULT 1,
    "placedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create news table
CREATE TABLE public.news (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT UNIQUE NOT NULL,
    "shortDescription" TEXT,
    "content" TEXT NOT NULL,
    "featuredImage" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT '{}',
    "author" TEXT,
    "publishDate" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "status" TEXT DEFAULT 'Draft',
    "featured" BOOLEAN DEFAULT FALSE,
    "trending" BOOLEAN DEFAULT FALSE,
    "breaking" BOOLEAN DEFAULT FALSE,
    "views" INTEGER DEFAULT 0,
    "likes" INTEGER DEFAULT 0,
    "readingTime" INTEGER DEFAULT 1,
    "seoTitle" TEXT,
    "metaDescription" TEXT,
    "canonicalUrl" TEXT
);

-- Create cards table
CREATE TABLE public.cards (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT UNIQUE NOT NULL,
    "bank" TEXT,
    "network" TEXT,
    "image" TEXT,
    "annualFee" NUMERIC DEFAULT 0,
    "joiningFee" NUMERIC DEFAULT 0,
    "renewalFee" NUMERIC DEFAULT 0,
    "apr" NUMERIC DEFAULT 36,
    "interestFreeDays" INTEGER DEFAULT 45,
    "minIncome" NUMERIC DEFAULT 25000,
    "creditScore" INTEGER DEFAULT 700,
    "welcomeBonus" TEXT,
    "rewardRate" TEXT,
    "airportLounge" TEXT,
    "cashback" TEXT,
    "pros" TEXT,
    "cons" TEXT,
    "applyLink" TEXT,
    "eligibility" TEXT,
    "movieBenefits" TEXT,
    "fuelBenefits" TEXT,
    "diningBenefits" TEXT,
    "travelBenefits" TEXT,
    "insuranceBenefits" TEXT,
    "emiOption" BOOLEAN DEFAULT TRUE,
    "forexFee" NUMERIC DEFAULT 3.5,
    "howToApply" TEXT,
    "balanceTransfer" BOOLEAN DEFAULT FALSE,
    "documents" TEXT,
    "googlePay" BOOLEAN DEFAULT TRUE,
    "applePay" BOOLEAN DEFAULT TRUE,
    "samsungWallet" BOOLEAN DEFAULT FALSE,
    "contactless" BOOLEAN DEFAULT TRUE,
    "website" TEXT,
    "seoDesc" TEXT,
    "seoTitle" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscribers table
CREATE TABLE public.subscribers (
    "email" TEXT PRIMARY KEY,
    "source" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create settings table
CREATE TABLE public.settings (
    "id" TEXT PRIMARY KEY DEFAULT 'default',
    "siteName" TEXT DEFAULT 'WealthEngine',
    "tagline" TEXT,
    "contactEmail" TEXT,
    "smtpHost" TEXT,
    "accentTheme" TEXT DEFAULT 'light',
    "maintenanceMode" BOOLEAN DEFAULT FALSE,
    "maintenanceMessage" TEXT,
    "adsenseEnabled" BOOLEAN DEFAULT FALSE,
    "adBannerCode" TEXT,
    "adSidebarCode" TEXT
);
