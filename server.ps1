# ==============================================
# WEALTHENGINE — FINANCE & INVESTING PLATFORM SERVER
# server.ps1
# ==============================================

$port = 8083
$maxPortRetries = 10
$listener = $null

$root = "C:\Users\Shashwath\.gemini\antigravity\scratch\finvest-hub"
$dbDir = Join-Path $root "db"
$uploadDir = Join-Path $root "public\uploads"

# Ensure directories exist
if (!(Test-Path $dbDir)) { New-Item -ItemType Directory -Path $dbDir | Out-Null }
if (!(Test-Path $uploadDir)) { New-Item -ItemType Directory -Path $uploadDir | Out-Null }

# --- DATABASE HELPERS ---
function Get-DbFile($name, $defaultJson = "[]") {
    $filePath = Join-Path $dbDir "$name.json"
    if (Test-Path $filePath) {
        return Get-Content $filePath -Raw -Encoding UTF8
    }
    Set-Content $filePath -Value $defaultJson -Encoding UTF8
    return $defaultJson
}

function Save-DbFile($name, $json) {
    $filePath = Join-Path $dbDir "$name.json"
    Set-Content $filePath -Value $json -Encoding UTF8
}

# --- SECURITY HELPERS ---
function Get-Sha256Hash($inputString, $salt) {
    $salted = $inputString + $salt
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($salted)
    $hashBytes = $sha.ComputeHash($bytes)
    return [System.BitConverter]::ToString($hashBytes).Replace("-", "").ToLower()
}

function New-SessionToken($email, $role) {
    $header = @{ alg = "HS256"; typ = "JWT" }
    $payload = @{
        email = $email
        role = $role
        exp = ([DateTimeOffset]::UtcNow.AddDays(7).ToUnixTimeSeconds())
    }
    
    $hBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $header -Compress)))
    $pBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $payload -Compress)))
    
    $signatureInput = "$hBase64.$pBase64"
    $sig = Get-Sha256Hash $signatureInput "wealthengine_jwt_secret_salt_2026"
    
    return "$hBase64.$pBase64.$sig"
}

function Verify-SessionToken($token) {
    if ($null -eq $token -or $token -eq "") { return $null }
    $parts = $token.Split(".")
    if ($parts.Length -ne 3) { return $null }
    
    $hBase64 = $parts[0]
    $pBase64 = $parts[1]
    $sig = $parts[2]
    
    $expectedSig = Get-Sha256Hash "$hBase64.$pBase64" "wealthengine_jwt_secret_salt_2026"
    if ($sig -ne $expectedSig) { return $null }
    
    try {
        $payloadJson = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($pBase64))
        $payload = ConvertFrom-Json $payloadJson
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        if ($payload.exp -lt $now) { return $null }
        return $payload
    } catch {
        return $null
    }
}

# --- SEED DEFAULT DATABASE DATA ---
# Default Categories
$defaultCategories = @(
    @{ id = "cat-1"; name = "Personal Finance"; slug = "personal-finance"; description = "Master budgeting, emergency reserves, debt payoff, and savings techniques." },
    @{ id = "cat-2"; name = "Investing"; slug = "investing"; description = "Explore long-term wealth accumulation strategies, stock market terms, ETFs, and SIPs." },
    @{ id = "cat-3"; name = "Taxes & Retirement"; slug = "taxes-retirement"; description = "Navigate tax structures, tax saving investments, and FIRE planning formulas." }
)
$null = Get-DbFile "categories" (ConvertTo-Json $defaultCategories -Depth 5 -Compress)

# Glossary Terms Seed
$defaultGlossary = @(
    @{ term = "CAGR"; title = "Compound Annual Growth Rate"; definition = "The geometric progression ratio that provides a constant rate of return over a specified time period. Formula: [(End Value / Start Value)^(1 / Years)] - 1." },
    @{ term = "P/E Ratio"; title = "Price-to-Earnings Ratio"; definition = "The valuation metric calculated by dividing the company's current share market price by its Earnings Per Share (EPS). Used to value companies." },
    @{ term = "ETF"; title = "Exchange Traded Fund"; definition = "A type of pooled investment security that operates much like a mutual fund but is bought and sold directly on stock exchanges throughout the day." },
    @{ term = "SIP"; title = "Systematic Investment Plan"; definition = "An investment methodology where a fixed amount of capital is regularly channeled into mutual funds or index funds, enabling rupee-cost averaging." },
    @{ term = "Asset Allocation"; title = "Asset Allocation Plan"; definition = "The strategy of dividing an investment portfolio among different asset classes, such as stocks (equity), bonds (debt), gold, and cash, to manage volatility." },
    @{ term = "FIRE"; title = "Financial Independence, Retire Early"; definition = "A lifestyle movement aimed at extreme savings and investing (often 50-70% of income) to retire decades earlier than traditional age limits." },
    @{ term = "401(k)"; title = "Employer-Sponsored Retirement Account"; definition = "A retirement savings plan sponsored by an employer. It lets workers save and invest a piece of their paycheck before taxes are taken out." },
    @{ term = "APR"; title = "Annual Percentage Rate"; definition = "The yearly interest rate charged on borrowing or earned on investing, without taking compounding into account." },
    @{ term = "APY"; title = "Annual Percentage Yield"; definition = "The real rate of return earned on an investment, taking into account the effect of compounding interest." },
    @{ term = "Amortization"; title = "Amortization Schedule"; definition = "The process of spreading out a loan into a series of fixed periodic payments over time, where each payment covers both principal and interest." },
    @{ term = "Asset"; title = "Asset Valuation"; definition = "A resource with economic value that an individual, corporation, or country owns or controls with the expectation that it will provide a future benefit." },
    @{ term = "Bear Market"; title = "Bear Market Cycle"; definition = "A condition in which securities prices fall 20% or more from recent highs, accompanied by widespread pessimism and negative investor sentiment." },
    @{ term = "Beta"; title = "Volatility Beta Coefficient"; definition = "A measure of a stock's volatility or systematic risk in comparison to the entire market. A beta of 1.0 matches the market." },
    @{ term = "Bond"; title = "Debt Instrument Bond"; definition = "A fixed-income instrument that represents a loan made by an investor to a borrower (typically corporate or governmental)." },
    @{ term = "Bull Market"; title = "Bull Market Trend"; definition = "A financial market of a group of securities in which prices are rising or are expected to rise over a sustained period." },
    @{ term = "Capital Gain"; title = "Capital Gains Tax"; definition = "An increase in the value of a capital asset (investment or real estate) that gives it a higher worth than the purchase price." },
    @{ term = "Cash Flow"; title = "Net Cash Flow"; definition = "The net amount of cash and cash-equivalents being transferred into and out of a business or personal account." },
    @{ term = "Compound Interest"; title = "Power of Compounding"; definition = "The addition of interest to the principal sum of a loan or deposit, or interest on interest. Formula: A = P(1 + r/n)^(nt)." },
    @{ term = "Credit Score"; title = "FICO Credit Rating"; definition = "A numerical expression based on a level analysis of a person's credit files, to represent the creditworthiness of an individual." },
    @{ term = "Debt-to-Income Ratio"; title = "DTI Ratio"; definition = "The percentage of a consumer's monthly gross income that goes toward paying debts (such as loans, mortgages, or credit cards)." },
    @{ term = "Diversification"; title = "Portfolio Diversification"; definition = "A risk management strategy that mixes a wide variety of investments within a portfolio to limit exposure to any single asset." },
    @{ term = "Dividend"; title = "Dividend Yield Payout"; definition = "The distribution of some of a company's earnings to a class of its shareholders, determined by the company's board of directors." },
    @{ term = "Emergency Fund"; title = "Liquid Cash Shield"; definition = "An easily accessible stash of cash set aside to cover financial surprises or job losses, preventing forced debt or portfolio liquidations." },
    @{ term = "Inflation"; title = "Purchasing Power Inflation"; definition = "The rate at which the general level of prices for goods and services is rising, and, consequently, purchasing power is falling." },
    @{ term = "Mutual Fund"; title = "Pooled Investment Fund"; definition = "A company that pools money from many investors and invests the money in securities such as stocks, bonds, and short-term debt." },
    @{ term = "Net Worth"; title = "Net Assets Valuation"; definition = "The value of all the non-financial and financial assets owned by an individual or institution, minus all its outstanding liabilities." },
    @{ term = "Portfolio"; title = "Investment Portfolio"; definition = "A grouping of financial assets such as stocks, bonds, commodities, currencies, and cash equivalents, as well as their mutual fund counterparts." },
    @{ term = "Principal"; title = "Original Loan Principal"; definition = "The original sum of money lent or invested on a compound interest rate, separate from the interest that accumulates over time." },
    @{ term = "Risk Tolerance"; title = "Risk Capacity Quiz"; definition = "The degree of variability in investment returns that an investor is willing to withstand in their financial planning." },
    @{ term = "Volatility"; title = "Market Volatility Index"; definition = "A statistical measure of the dispersion of returns for a given security or market index, representing rate variations." }
)
$null = Get-DbFile "glossary" (ConvertTo-Json $defaultGlossary -Depth 5 -Compress)

# Default Settings (Anonymized & Cleaned)
$defaultSettings = @{
    siteName = "WealthEngine"
    tagline = "Your Digital Guide to Financial Literacy & Investing"
    adsenseEnabled = $false
    adBannerCode = ""
    adSidebarCode = ""
}
$null = Get-DbFile "settings" (ConvertTo-Json $defaultSettings -Depth 5 -Compress)

# Default Credit Cards Seed
$defaultCards = @(
    @{
        id = "card-1"
        name = "FinVest Rewards Elite"
        bank = "Apex Bank"
        network = "Visa"
        image = "/public/uploads/rewards_elite.png"
        annualFee = 1500
        joiningFee = 1500
        renewalFee = 1500
        apr = 36
        interestFreeDays = 50
        minIncome = 30000
        creditScore = 750
        welcomeBonus = "10,000 Reward Points on joining"
        rewardRate = "4 points per ₹150 spent"
        cashback = "1% general cashback"
        airportLounge = "4 complimentary visits per year"
        fuelBenefits = "1% fuel surcharge waiver"
        diningBenefits = "Up to 20% discount at partner restaurants"
        travelBenefits = "Complimentary travel insurance up to ₹50 Lakhs"
        movieBenefits = "Buy 1 Get 1 free movie ticket monthly"
        insuranceBenefits = "Air accident cover"
        forexFee = 2.5
        emiOption = $true
        balanceTransfer = $true
        contactless = $true
        applePay = $true
        googlePay = $true
        samsungWallet = $false
        pros = "High reward rate on dining, complimentary lounge access"
        cons = "High annual fee, high APR on unpaid balances"
        eligibility = "Income ₹30,000+ per month, age 21-65"
        documents = "PAN card, Aadhaar card, Form 16 / Salary slips"
        howToApply = "Apply online via Apex Bank web portal or visit branch."
        website = "https://example.com/apex-rewards"
        seoTitle = "FinVest Rewards Elite Credit Card - Apex Bank"
        seoDesc = "Apply for FinVest Rewards Elite credit card. High rewards on dining and travel."
        slug = "finvest-rewards-elite"
    },
    @{
        id = "card-2"
        name = "Emerald Cashback Max"
        bank = "Unity Bank"
        network = "Mastercard"
        image = "/public/uploads/cashback_max.png"
        annualFee = 0
        joiningFee = 0
        renewalFee = 0
        apr = 42
        interestFreeDays = 45
        minIncome = 20000
        creditScore = 700
        welcomeBonus = "₹500 cashback on first swipe"
        rewardRate = "5% cashback on online purchases"
        cashback = "5% online, 1.5% offline"
        airportLounge = "No lounge access"
        fuelBenefits = "1% fuel surcharge waiver"
        diningBenefits = "15% off at select restaurants"
        travelBenefits = "None"
        movieBenefits = "None"
        insuranceBenefits = "None"
        forexFee = 3.5
        emiOption = $true
        balanceTransfer = $false
        contactless = $true
        applePay = $false
        googlePay = $true
        samsungWallet = $true
        pros = "Lifetime free card, industry-leading 5% online cashback"
        cons = "No airport lounge access, high foreign transaction fees"
        eligibility = "Income ₹20,000+ per month, age 18-60"
        documents = "Identity proof, Income tax return / salary slips"
        howToApply = "Instant online approval on Unity Bank portal."
        website = "https://example.com/cashback-max"
        seoTitle = "Emerald Cashback Max Credit Card - Unity Bank"
        seoDesc = "Get 5% cashback on online shopping with Emerald Cashback Max. Lifetime free."
        slug = "emerald-cashback-max"
    }
)
$null = Get-DbFile "cards" (ConvertTo-Json $defaultCards -Depth 5 -Compress)

# Default Admin User
$adminSalt = "admin_salt_7777"
$adminHash = Get-Sha256Hash "12345678" $adminSalt
$defaultUsers = @(
    @{
        id = "usr-1"
        email = "shashwaththangarajan@gmail.com"
        name = "FinVest Expert"
        passwordHash = $adminHash
        passwordSalt = $adminSalt
        role = "Super Admin"
        bio = "Chief Finance Curator and Principal Administrator at FinVest Hub."
        avatar = "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80"
        bookmarks = @()
        likes = @()
        history = @()
    }
)
$null = Get-DbFile "users" (ConvertTo-Json $defaultUsers -Depth 5 -Compress)

# Default Articles
$defaultPosts = @(
    @{
        id = "post-1"
        title = "SIP vs Lump Sum: Which Wealth Engine Wins?"
        slug = "sip-vs-lump-sum-wealth-engine-wins"
        content = "Investing regularly through a Systematic Investment Plan (SIP) helps mitigate market timing risks via dollar-cost averaging. In contrast, lump sum investing deploys all capital immediately, maximizing time-in-the-market compounding benefits. In this guide, we break down historical index return profiles to show which strategy outperforms during varying market cycles."
        excerpt = "A comprehensive comparison analysis detailing long-term systematic investing vs immediate lump sum allocation."
        status = "Published"
        featuredImage = "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80"
        author = "shashwaththangarajan@gmail.com"
        authorName = "FinVest Expert"
        categoryId = "cat-2"
        tags = @("Investing", "SIP")
        views = 284
        likes = 56
        claps = 41
        readingTime = 5
        placedAt = ([DateTime]::UtcNow.AddDays(-2).ToString("o"))
    },
    @{
        id = "post-2"
        title = "The Emergency Fund Guide: Shielding Your Wealth"
        slug = "emergency-fund-guide-shielding-wealth"
        content = "Before putting capital into the stock market, you must establish an emergency fund. Experts recommend keeping 3 to 6 months of absolute living expenses in highly liquid cash equivalents, such as high-yield savings accounts or short-term liquid funds. This shield prevents you from being forced to liquidate equity portfolios during market downturns."
        excerpt = "Learn why liquid cash reserves are the foundation of any sound personal finance strategy."
        status = "Published"
        featuredImage = "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=80"
        author = "shashwaththangarajan@gmail.com"
        authorName = "FinVest Expert"
        categoryId = "cat-1"
        tags = @("Personal Finance", "Savings")
        views = 192
        likes = 45
        claps = 29
        readingTime = 4
        placedAt = ([DateTime]::UtcNow.AddDays(-4).ToString("o"))
    }
)
$null = Get-DbFile "posts" (ConvertTo-Json $defaultPosts -Depth 5 -Compress)

# --- RESPONSE HELPERS ---
function Send-JsonResponseString($response, $statusCode, $jsonString) {
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonString)
        $response.StatusCode = $statusCode
        $response.ContentType = "application/json; charset=utf-8"
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.Close()
    } catch {
        # Silent fail on socket closed
    }
}

function Send-JsonResponse($response, $statusCode, $object) {
    $json = ConvertTo-Json $object -Depth 10 -Compress
    Send-JsonResponseString $response $statusCode $json
}

# Normalize Mime Types
function Get-MimeType($ext) {
    switch ($ext.ToLower()) {
        ".html" { return "text/html; charset=utf-8" }
        ".css"  { return "text/css" }
        ".js"   { return "application/javascript" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".svg"  { return "image/svg+xml" }
        ".json" { return "application/json" }
        default { return "application/octet-stream" }
    }
}

# --- SERVER LIFECYCLE ---
$bindSuccess = $false
for ($i = 0; $i -lt $maxPortRetries; $i++) {
    try {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$port/")
        $listener.Prefixes.Add("http://127.0.0.1:$port/")
        $listener.Start()
        $bindSuccess = $true
        break
    } catch {
        Write-Output "Port $port in use, retrying next port..."
        $port++
    }
}

if (!$bindSuccess) {
    Write-Error "Failed to bind HttpListener. Exiting."
    exit
}

Write-Output "--------------------------------------------------"
Write-Output "  WEALTHENGINE LOCAL SERVER RUNNING"
Write-Output "--------------------------------------------------"
Write-Output "  URL: http://localhost:$port"
Write-Output "  Serving files from: $root"
Write-Output "  Press Ctrl+C to terminate the server."
Write-Output "--------------------------------------------------"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    
    $urlPath = $request.Url.AbsolutePath
    $method = $request.HttpMethod

    $response.AddHeader("Access-Control-Allow-Origin", "*")
    $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

    if ($method -eq "OPTIONS") {
        $response.StatusCode = 200
        $response.Close()
        continue
    }

    $authHeader = $request.Headers["Authorization"]
    $currentUser = $null
    if ($null -ne $authHeader -and $authHeader -like "Bearer *") {
        $token = $authHeader.Substring(7)
        $currentUser = Verify-SessionToken $token
    }

    $body = ""
    if ($request.HasEntityBody) {
        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd()
    }

    if ($urlPath.StartsWith("/api/")) {
        Write-Output "[$method] $urlPath"
        
        try {
            # ── 1. AUTH API ──
            if ($urlPath -eq "/api/auth/register") {
                if ($method -eq "POST") {
                    $reg = ConvertFrom-Json $body
                    $users = ConvertFrom-Json (Get-DbFile "users")
                    
                    if ($users | Where-Object { $_.email -eq $reg.email }) {
                        Send-JsonResponse $response 400 @{ error = "Email already registered." }
                    } else {
                        $salt = [Guid]::NewGuid().ToString().Substring(0, 8)
                        $hash = Get-Sha256Hash $reg.password $salt
                        
                        $newUser = @{
                            id = "usr-" + [Guid]::NewGuid().ToString().Substring(0, 8)
                            email = $reg.email
                            name = $reg.name
                            passwordHash = $hash
                            passwordSalt = $salt
                            role = "Subscriber"
                            bio = ""
                            avatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                            bookmarks = @()
                            likes = @()
                            history = @()
                        }
                        
                        $users += $newUser
                        Save-DbFile "users" (ConvertTo-Json $users -Depth 5 -Compress)
                        
                        $token = New-SessionToken $newUser.email $newUser.role
                        Send-JsonResponse $response 200 @{ token = $token; user = @{ email = $newUser.email; name = $newUser.name; role = $newUser.role } }
                    }
                }
            }
            elseif ($urlPath -eq "/api/auth/login") {
                if ($method -eq "POST") {
                    $login = ConvertFrom-Json $body
                    $users = ConvertFrom-Json (Get-DbFile "users")
                    $user = $users | Where-Object { $_.email -eq $login.email }
                    
                    if ($null -eq $user) {
                        Send-JsonResponse $response 400 @{ error = "Invalid email or password." }
                    } else {
                        $hash = Get-Sha256Hash $login.password $user.passwordSalt
                        if ($hash -eq $user.passwordHash) {
                            $token = New-SessionToken $user.email $user.role
                            Send-JsonResponse $response 200 @{ token = $token; user = @{ email = $user.email; name = $user.name; role = $user.role; avatar = $user.avatar; bio = $user.bio } }
                        } else {
                            Send-JsonResponse $response 400 @{ error = "Invalid email or password." }
                        }
                    }
                }
            }
            elseif ($urlPath -eq "/api/auth/me") {
                if ($method -eq "GET") {
                    if ($null -eq $currentUser) {
                        Send-JsonResponse $response 401 @{ error = "Unauthorized." }
                    } else {
                        $users = ConvertFrom-Json (Get-DbFile "users")
                        $user = $users | Where-Object { $_.email -eq $currentUser.email }
                        if ($null -eq $user) {
                            Send-JsonResponse $response 404 @{ error = "User not found." }
                        } else {
                            Send-JsonResponse $response 200 @{
                                email = $user.email
                                name = $user.name
                                role = $user.role
                                bio = $user.bio
                                avatar = $user.avatar
                                bookmarks = $user.bookmarks
                                likes = $user.likes
                                history = $user.history
                            }
                        }
                    }
                }
            }
            elseif ($urlPath -eq "/api/auth/profile") {
                if ($method -eq "POST") {
                    if ($null -eq $currentUser) {
                        Send-JsonResponse $response 401 @{ error = "Unauthorized." }
                    } else {
                        $profileData = ConvertFrom-Json $body
                        $users = ConvertFrom-Json (Get-DbFile "users")
                        
                        for ($idx = 0; $idx -lt $users.Length; $idx++) {
                            if ($users[$idx].email -eq $currentUser.email) {
                                if ($null -ne $profileData.name) { $users[$idx].name = $profileData.name }
                                if ($null -ne $profileData.bio) { $users[$idx].bio = $profileData.bio }
                                if ($null -ne $profileData.avatar) { $users[$idx].avatar = $profileData.avatar }
                                if ($null -ne $profileData.bookmarks) { $users[$idx].bookmarks = $profileData.bookmarks }
                                if ($null -ne $profileData.likes) { $users[$idx].likes = $profileData.likes }
                                if ($null -ne $profileData.history) { $users[$idx].history = $profileData.history }
                                
                                if ($null -ne $profileData.newPassword -and $profileData.newPassword -ne "") {
                                    $oldHash = Get-Sha256Hash $profileData.oldPassword $users[$idx].passwordSalt
                                    if ($oldHash -ne $users[$idx].passwordHash) {
                                        Send-JsonResponse $response 400 @{ error = "Incorrect current password." }
                                        $response.Close()
                                        continue
                                    }
                                    $users[$idx].passwordSalt = [Guid]::NewGuid().ToString().Substring(0, 8)
                                    $users[$idx].passwordHash = Get-Sha256Hash $profileData.newPassword $users[$idx].passwordSalt
                                }
                                break
                            }
                        }
                        Save-DbFile "users" (ConvertTo-Json $users -Depth 5 -Compress)
                        Send-JsonResponse $response 200 @{ success = $true; message = "Profile updated." }
                    }
                }
            }

            # ── 2. ARTICLES API ──
            elseif ($urlPath -eq "/api/posts") {
                if ($method -eq "GET") {
                    $posts = ConvertFrom-Json (Get-DbFile "posts")
                    
                    $status = $request.QueryString["status"]
                    $category = $request.QueryString["category"]
                    $tag = $request.QueryString["tag"]
                    $q = $request.QueryString["q"]
                    $author = $request.QueryString["author"]
                    
                    if ($null -eq $status) { $status = "Published" }
                    
                    $filtered = $posts
                    if ($status -ne "all") {
                        $filtered = $filtered | Where-Object { $_.status -eq $status }
                    }
                    if ($null -ne $category -and $category -ne "") {
                        $filtered = $filtered | Where-Object { $_.categoryId -eq $category }
                    }
                    if ($null -ne $tag -and $tag -ne "") {
                        $filtered = $filtered | Where-Object { $_.tags -contains $tag }
                    }
                    if ($null -ne $author -and $author -ne "") {
                        $filtered = $filtered | Where-Object { $_.author -eq $author }
                    }
                    if ($null -ne $q -and $q -ne "") {
                        $qLower = $q.ToLower()
                        $filtered = $filtered | Where-Object { 
                            $_.title.ToLower().Contains($qLower) -or 
                            $_.content.ToLower().Contains($qLower) -or 
                            $_.excerpt.ToLower().Contains($qLower)
                        }
                    }
                    
                    $sorted = $filtered | Sort-Object placedAt -Descending
                    Send-JsonResponse $response 200 $sorted
                }
                elseif ($method -eq "POST") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin", "Editor") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $postObj = ConvertFrom-Json $body
                        $posts = ConvertFrom-Json (Get-DbFile "posts")
                        
                        $slug = $postObj.title.ToLower().Replace(" ", "-").Replace("?", "").Replace("!", "").Replace("/", "-")
                        $slug = [Regex]::Replace($slug, "[^a-z0-9\-]", "")
                        
                        $newPost = @{
                            id = "post-" + [Guid]::NewGuid().ToString().Substring(0, 8)
                            title = $postObj.title
                            slug = $slug
                            content = $postObj.content
                            excerpt = $postObj.excerpt
                            status = if ($null -ne $postObj.status) { $postObj.status } else { "Draft" }
                            featuredImage = if ($null -ne $postObj.featuredImage -and $postObj.featuredImage -ne "") { $postObj.featuredImage } else { "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80" }
                            author = $currentUser.email
                            authorName = if ($null -ne $currentUser.name) { $currentUser.name } else { $currentUser.email }
                            categoryId = $postObj.categoryId
                            tags = if ($null -ne $postObj.tags) { $postObj.tags } else { @() }
                            views = 0
                            likes = 0
                            claps = 0
                            readingTime = [Math]::Max(1, [Math]::Round(($postObj.content.Split(" ").Length) / 200))
                            placedAt = ([DateTime]::UtcNow.ToString("o"))
                        }
                        
                        $posts += $newPost
                        Save-DbFile "posts" (ConvertTo-Json $posts -Depth 5 -Compress)
                        Send-JsonResponse $response 200 $newPost
                    }
                }
            }
            elseif ($urlPath -eq "/api/posts/detail") {
                $slug = $request.QueryString["slug"]
                $id = $request.QueryString["id"]
                
                $posts = ConvertFrom-Json (Get-DbFile "posts")
                $post = $null
                
                if ($null -ne $slug) {
                    $post = $posts | Where-Object { $_.slug -eq $slug }
                } elseif ($null -ne $id) {
                    $post = $posts | Where-Object { $_.id -eq $id }
                }
                
                if ($null -eq $post) {
                    Send-JsonResponse $response 404 @{ error = "Article not found." }
                } else {
                    if ($method -eq "GET") {
                        $post.views = $post.views + 1
                        Save-DbFile "posts" (ConvertTo-Json $posts -Depth 5 -Compress)
                        Send-JsonResponse $response 200 $post
                    }
                    elseif ($method -eq "PUT") {
                        if ($null -eq $currentUser -or @("Super Admin", "Admin", "Editor") -notcontains $currentUser.role) {
                            Send-JsonResponse $response 403 @{ error = "Forbidden." }
                        } else {
                            $updated = ConvertFrom-Json $body
                            $post.title = $updated.title
                            $post.content = $updated.content
                            $post.excerpt = $updated.excerpt
                            $post.categoryId = $updated.categoryId
                            $post.status = $updated.status
                            $post.featuredImage = $updated.featuredImage
                            $post.tags = $updated.tags
                            $post.readingTime = [Math]::Max(1, [Math]::Round(($updated.content.Split(" ").Length) / 200))
                            
                            Save-DbFile "posts" (ConvertTo-Json $posts -Depth 5 -Compress)
                            Send-JsonResponse $response 200 $post
                        }
                    }
                    elseif ($method -eq "DELETE") {
                        if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                            Send-JsonResponse $response 403 @{ error = "Forbidden." }
                        } else {
                            $newPosts = $posts | Where-Object { $_.id -ne $post.id }
                            Save-DbFile "posts" (ConvertTo-Json $newPosts -Depth 5 -Compress)
                            Send-JsonResponse $response 200 @{ success = $true }
                        }
                    }
                }
            }
            elseif ($urlPath -eq "/api/posts/interaction") {
                if ($method -eq "POST") {
                    $action = ConvertFrom-Json $body
                    $posts = ConvertFrom-Json (Get-DbFile "posts")
                    $post = $posts | Where-Object { $_.id -eq $action.postId }
                    
                    if ($null -eq $post) {
                        Send-JsonResponse $response 404 @{ error = "Article not found." }
                    } else {
                        if ($action.type -eq "like") { $post.likes = $post.likes + 1 }
                        elseif ($action.type -eq "clap") { $post.claps = $post.claps + 1 }
                        Save-DbFile "posts" (ConvertTo-Json $posts -Depth 5 -Compress)
                        Send-JsonResponse $response 200 @{ success = $true; likes = $post.likes; claps = $post.claps }
                    }
                }
            }

            # ── 2B. NEWS MODULE API ──
            elseif ($urlPath -eq "/api/news") {
                if ($method -eq "GET") {
                    $newsList = @(ConvertFrom-Json (Get-DbFile "news" "[]"))
                    
                    $status = $request.QueryString["status"]
                    $category = $request.QueryString["category"]
                    $tag = $request.QueryString["tag"]
                    $q = $request.QueryString["q"]
                    $author = $request.QueryString["author"]
                    $featured = $request.QueryString["featured"]
                    $trending = $request.QueryString["trending"]
                    $breaking = $request.QueryString["breaking"]
                    
                    if ($null -eq $status) { $status = "Publish" }
                    
                    $filtered = $newsList
                    if ($status -ne "all") {
                        $filtered = $filtered | Where-Object { $_.status -eq $status }
                    }
                    if ($null -ne $category -and $category -ne "") {
                        $filtered = $filtered | Where-Object { $_.category -eq $category }
                    }
                    if ($null -ne $tag -and $tag -ne "") {
                        $filtered = $filtered | Where-Object { $_.tags -contains $tag }
                    }
                    if ($null -ne $author -and $author -ne "") {
                        $filtered = $filtered | Where-Object { $_.author -eq $author }
                    }
                    if ($null -ne $featured -and $featured -ne "") {
                        $fBool = [System.Convert]::ToBoolean($featured)
                        $filtered = $filtered | Where-Object { $_.featured -eq $fBool }
                    }
                    if ($null -ne $trending -and $trending -ne "") {
                        $tBool = [System.Convert]::ToBoolean($trending)
                        $filtered = $filtered | Where-Object { $_.trending -eq $tBool }
                    }
                    if ($null -ne $breaking -and $breaking -ne "") {
                        $bBool = [System.Convert]::ToBoolean($breaking)
                        $filtered = $filtered | Where-Object { $_.breaking -eq $bBool }
                    }
                    if ($null -ne $q -and $q -ne "") {
                        $qLower = $q.ToLower()
                        $filtered = $filtered | Where-Object { 
                            $_.title.ToLower().Contains($qLower) -or 
                            $_.content.ToLower().Contains($qLower) -or 
                            $_.shortDescription.ToLower().Contains($qLower)
                        }
                    }
                    
                    $sorted = $filtered | Sort-Object publishDate -Descending
                    Send-JsonResponse $response 200 $sorted
                }
                elseif ($method -eq "POST") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin", "Editor") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $newsObj = ConvertFrom-Json $body
                        $newsList = @(ConvertFrom-Json (Get-DbFile "news" "[]"))
                        
                        $slug = $newsObj.title.ToLower().Replace(" ", "-").Replace("?", "").Replace("!", "").Replace("/", "-")
                        $slug = [Regex]::Replace($slug, "[^a-z0-9\-]", "")
                        
                        $newNews = @{
                            id = "news-" + [Guid]::NewGuid().ToString().Substring(0, 8)
                            title = $newsObj.title
                            slug = $slug
                            shortDescription = $newsObj.shortDescription
                            content = $newsObj.content
                            featuredImage = if ($null -ne $newsObj.featuredImage -and $newsObj.featuredImage -ne "") { $newsObj.featuredImage } else { "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80" }
                            category = $newsObj.category
                            tags = if ($null -ne $newsObj.tags) { $newsObj.tags } else { @() }
                            author = if ($null -ne $newsObj.author -and $newsObj.author -ne "") { $newsObj.author } else { "FinVest News Desk" }
                            publishDate = if ($null -ne $newsObj.publishDate -and $newsObj.publishDate -ne "") { $newsObj.publishDate } else { ([DateTime]::UtcNow.ToString("o")) }
                            status = if ($null -ne $newsObj.status) { $newsObj.status } else { "Draft" }
                            featured = if ($null -ne $newsObj.featured) { [System.Convert]::ToBoolean($newsObj.featured) } else { $false }
                            trending = if ($null -ne $newsObj.trending) { [System.Convert]::ToBoolean($newsObj.trending) } else { $false }
                            breaking = if ($null -ne $newsObj.breaking) { [System.Convert]::ToBoolean($newsObj.breaking) } else { $false }
                            views = 0
                            likes = 0
                            readingTime = [Math]::Max(1, [Math]::Round(($newsObj.content.Split(" ").Length) / 200))
                            seoTitle = if ($null -ne $newsObj.seoTitle -and $newsObj.seoTitle -ne "") { $newsObj.seoTitle } else { $newsObj.title }
                            metaDescription = if ($null -ne $newsObj.metaDescription -and $newsObj.metaDescription -ne "") { $newsObj.metaDescription } else { $newsObj.shortDescription }
                            canonicalUrl = if ($null -ne $newsObj.canonicalUrl -and $newsObj.canonicalUrl -ne "") { $newsObj.canonicalUrl } else { "http://localhost:8083/#news/" + $slug }
                        }
                        
                        $newsList += $newNews
                        Save-DbFile "news" (ConvertTo-Json $newsList -Depth 5 -Compress)
                        Send-JsonResponse $response 200 $newNews
                    }
                }
            }
            elseif ($urlPath -eq "/api/news/detail") {
                $slug = $request.QueryString["slug"]
                $id = $request.QueryString["id"]
                
                $newsList = @(ConvertFrom-Json (Get-DbFile "news" "[]"))
                $newsItem = $null
                
                if ($null -ne $slug) {
                    $newsItem = $newsList | Where-Object { $_.slug -eq $slug }
                } elseif ($null -ne $id) {
                    $newsItem = $newsList | Where-Object { $_.id -eq $id }
                }
                
                if ($null -eq $newsItem) {
                    Send-JsonResponse $response 404 @{ error = "News article not found." }
                } else {
                    if ($method -eq "GET") {
                        $newsItem.views = $newsItem.views + 1
                        Save-DbFile "news" (ConvertTo-Json $newsList -Depth 5 -Compress)
                        Send-JsonResponse $response 200 $newsItem
                    }
                    elseif ($method -eq "PUT") {
                        if ($null -eq $currentUser -or @("Super Admin", "Admin", "Editor") -notcontains $currentUser.role) {
                            Send-JsonResponse $response 403 @{ error = "Forbidden." }
                        } else {
                            $updated = ConvertFrom-Json $body
                            $newsItem.title = $updated.title
                            $newsItem.shortDescription = $updated.shortDescription
                            $newsItem.content = $updated.content
                            $newsItem.featuredImage = $updated.featuredImage
                            $newsItem.category = $updated.category
                            $newsItem.tags = if ($null -ne $updated.tags) { $updated.tags } else { @() }
                            $newsItem.author = $updated.author
                            $newsItem.publishDate = $updated.publishDate
                            $newsItem.status = $updated.status
                            $newsItem.featured = [System.Convert]::ToBoolean($updated.featured)
                            $newsItem.trending = [System.Convert]::ToBoolean($updated.trending)
                            $newsItem.breaking = [System.Convert]::ToBoolean($updated.breaking)
                            $newsItem.seoTitle = $updated.seoTitle
                            $newsItem.metaDescription = $updated.metaDescription
                            $newsItem.canonicalUrl = $updated.canonicalUrl
                            $newsItem.readingTime = [Math]::Max(1, [Math]::Round(($updated.content.Split(" ").Length) / 200))
                            
                            Save-DbFile "news" (ConvertTo-Json $newsList -Depth 5 -Compress)
                            Send-JsonResponse $response 200 $newsItem
                        }
                    }
                    elseif ($method -eq "DELETE") {
                        if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                            Send-JsonResponse $response 403 @{ error = "Forbidden." }
                        } else {
                            $newNewsList = $newsList | Where-Object { $_.id -ne $newsItem.id }
                            Save-DbFile "news" (ConvertTo-Json $newNewsList -Depth 5 -Compress)
                            Send-JsonResponse $response 200 @{ success = $true }
                        }
                    }
                }
            }
            elseif ($urlPath -eq "/api/news/interaction") {
                if ($method -eq "POST") {
                    $action = ConvertFrom-Json $body
                    $newsList = @(ConvertFrom-Json (Get-DbFile "news" "[]"))
                    $newsItem = $newsList | Where-Object { $_.id -eq $action.newsId }
                    
                    if ($null -eq $newsItem) {
                        Send-JsonResponse $response 404 @{ error = "News article not found." }
                    } else {
                        if ($action.type -eq "like") { $newsItem.likes = $newsItem.likes + 1 }
                        Save-DbFile "news" (ConvertTo-Json $newsList -Depth 5 -Compress)
                        Send-JsonResponse $response 200 @{ success = $true; likes = $newsItem.likes }
                    }
                }
            }

            # ── 3. GLOSSARY TERM DEFINITIONS API ──
            elseif ($urlPath -eq "/api/glossary") {
                if ($method -eq "GET") {
                    $q = $request.QueryString["q"]
                    $glossary = ConvertFrom-Json (Get-DbFile "glossary")
                    if ($null -ne $q -and $q -ne "") {
                        $qLower = $q.ToLower()
                        $glossary = $glossary | Where-Object { 
                            $_.term.ToLower().Contains($qLower) -or 
                            $_.title.ToLower().Contains($qLower) -or 
                            $_.definition.ToLower().Contains($qLower)
                        }
                    }
                    Send-JsonResponse $response 200 $glossary
                }
                elseif ($method -eq "POST") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $termObj = ConvertFrom-Json $body
                        $glossary = ConvertFrom-Json (Get-DbFile "glossary")
                        
                        $newTerm = @{
                            term = $termObj.term.ToUpper()
                            title = $termObj.title
                            definition = $termObj.definition
                        }
                        
                        $glossary += $newTerm
                        Save-DbFile "glossary" (ConvertTo-Json $glossary -Depth 5 -Compress)
                        Send-JsonResponse $response 200 $newTerm
                    }
                }
            }

            # ── 4. COMMENTS API ──
            elseif ($urlPath -eq "/api/comments") {
                if ($method -eq "GET") {
                    $postId = $request.QueryString["postId"]
                    $comments = ConvertFrom-Json (Get-DbFile "comments")
                    
                    $filtered = $comments
                    if ($null -ne $postId -and $postId -ne "") {
                        $filtered = $filtered | Where-Object { $_.postId -eq $postId }
                    }
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        $filtered = $filtered | Where-Object { $_.status -eq "Approved" }
                    }
                    Send-JsonResponse $response 200 $filtered
                }
                elseif ($method -eq "POST") {
                    if ($null -eq $currentUser) {
                        Send-JsonResponse $response 401 @{ error = "Unauthorized." }
                    } else {
                        $commReq = ConvertFrom-Json $body
                        $comments = ConvertFrom-Json (Get-DbFile "comments")
                        
                        $newComment = @{
                            id = "comm-" + [Guid]::NewGuid().ToString().Substring(0, 8)
                            postId = $commReq.postId
                            content = $commReq.content
                            authorEmail = $currentUser.email
                            authorName = if ($null -ne $currentUser.name) { $currentUser.name } else { $currentUser.email }
                            authorAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                            status = "Approved"
                            placedAt = ([DateTime]::UtcNow.ToString("o"))
                        }
                        
                        $comments += $newComment
                        Save-DbFile "comments" (ConvertTo-Json $comments -Depth 5 -Compress)
                        Send-JsonResponse $response 200 $newComment
                    }
                }
            }
            elseif ($urlPath -eq "/api/comments/moderate") {
                if ($method -eq "POST") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $action = ConvertFrom-Json $body
                        $comments = ConvertFrom-Json (Get-DbFile "comments")
                        
                        if ($action.action -eq "delete") {
                            $newComments = $comments | Where-Object { $_.id -ne $action.commentId }
                            Save-DbFile "comments" (ConvertTo-Json $newComments -Depth 5 -Compress)
                            Send-JsonResponse $response 200 @{ success = $true }
                        } else {
                            $comment = $comments | Where-Object { $_.id -eq $action.commentId }
                            if ($null -ne $comment) {
                                if ($action.action -eq "approve") { $comment.status = "Approved" }
                                elseif ($action.action -eq "reject") { $comment.status = "Rejected" }
                            }
                            Save-DbFile "comments" (ConvertTo-Json $comments -Depth 5 -Compress)
                            Send-JsonResponse $response 200 @{ success = $true }
                        }
                    }
                }
            }

            # ── 5. SETTINGS & ADSENSE AD CODES ──
            elseif ($urlPath -eq "/api/settings") {
                if ($method -eq "GET") {
                    $settings = Get-DbFile "settings"
                    Send-JsonResponseString $response 200 $settings
                }
                elseif ($method -eq "POST") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        Save-DbFile "settings" $body
                        Send-JsonResponseString $response 200 $body
                    }
                }
            }

            # ── 6. NEWSLETTER SYSTEM ──
            elseif ($urlPath -eq "/api/newsletter/subscribe") {
                if ($method -eq "POST") {
                    $subReq = ConvertFrom-Json $body
                    $subscribers = ConvertFrom-Json (Get-DbFile "subscribers")
                    
                    if ($subscribers | Where-Object { $_.email -eq $subReq.email }) {
                        Send-JsonResponse $response 200 @{ success = $true; message = "Already subscribed." }
                    } else {
                        $newSub = @{
                            id = "sub-" + [Guid]::NewGuid().ToString().Substring(0, 8)
                            email = $subReq.email
                            status = "Active"
                            subscribedAt = ([DateTime]::UtcNow.ToString("o"))
                        }
                        $subscribers += $newSub
                        Save-DbFile "subscribers" (ConvertTo-Json $subscribers -Depth 5 -Compress)
                        Send-JsonResponse $response 200 @{ success = $true; message = "Successfully subscribed to drops." }
                    }
                }
            }
            elseif ($urlPath -eq "/api/newsletter/subscribers") {
                if ($method -eq "GET") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $subscribers = Get-DbFile "subscribers"
                        Send-JsonResponseString $response 200 $subscribers
                    }
                }
            }

            # ── 7. CATEGORIES API ──
            elseif ($urlPath -eq "/api/categories") {
                if ($method -eq "GET") {
                    $categories = Get-DbFile "categories"
                    Send-JsonResponseString $response 200 $categories
                }
            }

            # ── 8. MEDIA UPLOADER ──
            elseif ($urlPath -eq "/api/media/upload") {
                if ($method -eq "POST") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $uploadReq = ConvertFrom-Json $body
                        $filename = $uploadReq.filename
                        $base64Data = $uploadReq.base64
                        
                        if ($base64Data -match "^data:[^;]+;base64,(.*)$") {
                            $base64Data = $Matches[1]
                        }
                        
                        $bytes = [System.Convert]::FromBase64String($base64Data)
                        $safeFilename = [Guid]::NewGuid().ToString().Substring(0, 8) + "_" + $filename
                        $safeFilename = [Regex]::Replace($safeFilename, "[^a-zA-Z0-9\._\-]", "")
                        
                        $destPath = Join-Path $uploadDir $safeFilename
                        [System.IO.File]::WriteAllBytes($destPath, $bytes)
                        
                        Send-JsonResponse $response 200 @{
                            success = $true
                            url = "public/uploads/$safeFilename"
                        }
                    }
                }
            }
            elseif ($urlPath -eq "/api/media/list") {
                if ($method -eq "GET") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $files = Get-ChildItem -Path $uploadDir -File | ForEach-Object {
                            @{
                                name = $_.Name
                                url = "public/uploads/" + $_.Name
                                size = $_.Length
                                created = $_.CreationTime.ToString("o")
                            }
                        }
                        Send-JsonResponse $response 200 $files
                    }
                }
            }

            # ── 10. CREDIT CARDS API ──
            elseif ($urlPath -eq "/api/cards") {
                if ($method -eq "GET") {
                    $cards = Get-DbFile "cards"
                    Send-JsonResponseString $response 200 $cards
                }
                elseif ($method -eq "POST") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $cards = @(ConvertFrom-Json (Get-DbFile "cards"))
                        if ($null -eq $cards) { $cards = @() }
                        $newCard = ConvertFrom-Json $body
                        $newCard.id = "card-" + [Guid]::NewGuid().ToString().Substring(0, 8)
                        $cards += $newCard
                        Save-DbFile "cards" (ConvertTo-Json $cards -Depth 5 -Compress)
                        Send-JsonResponse $response 200 @{ success = $true; card = $newCard }
                    }
                }
                elseif ($method -eq "PUT") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $cards = @(ConvertFrom-Json (Get-DbFile "cards"))
                        $updatedCard = ConvertFrom-Json $body
                        for ($i = 0; $i -lt $cards.Count; $i++) {
                            if ($cards[$i].id -eq $updatedCard.id) {
                                $cards[$i] = $updatedCard
                                break
                            }
                        }
                        Save-DbFile "cards" (ConvertTo-Json $cards -Depth 5 -Compress)
                        Send-JsonResponse $response 200 @{ success = $true; card = $updatedCard }
                    }
                }
                elseif ($method -eq "DELETE") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $cardId = $request.QueryString["id"]
                        $cards = ConvertFrom-Json (Get-DbFile "cards")
                        $filtered = $cards | Where-Object { $_.id -ne $cardId }
                        Save-DbFile "cards" (ConvertTo-Json $filtered -Depth 5 -Compress)
                        Send-JsonResponse $response 200 @{ success = $true; message = "Card deleted." }
                    }
                }
            }
            elseif ($urlPath -eq "/api/cards/import") {
                if ($method -eq "POST") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $importReq = ConvertFrom-Json $body
                        $csvText = $importReq.csv
                        
                        # Parse simple CSV
                        $lines = $csvText -split "\r?\n"
                        if ($lines.Length -gt 1) {
                            $headers = $lines[0] -split ","
                            $cards = ConvertFrom-Json (Get-DbFile "cards")
                            if ($null -eq $cards) { $cards = @() }
                            
                            for ($i = 1; $i -lt $lines.Length; $i++) {
                                if ([string]::IsNullOrWhiteSpace($lines[$i])) { continue }
                                $values = $lines[$i] -split ","
                                $card = @{}
                                $card.id = "card-" + [Guid]::NewGuid().ToString().Substring(0, 8)
                                for ($j = 0; $j -lt $headers.Length; $j++) {
                                    if ($j -lt $values.Length) {
                                        $val = $values[$j].Trim().Trim('"').Trim("'")
                                        if ($val -as [double]) {
                                            $card[$headers[$j].Trim()] = [double]$val
                                        } elseif ($val -eq "true") {
                                            $card[$headers[$j].Trim()] = $true
                                        } elseif ($val -eq "false") {
                                            $card[$headers[$j].Trim()] = $false
                                        } else {
                                            $card[$headers[$j].Trim()] = $val
                                        }
                                    }
                                }
                                $cards += $card
                            }
                            Save-DbFile "cards" (ConvertTo-Json $cards -Depth 5 -Compress)
                            Send-JsonResponse $response 200 @{ success = $true; message = "CSV imported successfully." }
                        } else {
                            Send-JsonResponse $response 400 @{ error = "Invalid CSV format." }
                        }
                    }
                }
            }
            elseif ($urlPath -eq "/api/cards/export") {
                if ($method -eq "GET") {
                    $cards = ConvertFrom-Json (Get-DbFile "cards")
                    $headers = @("name", "bank", "network", "annualFee", "joiningFee", "apr", "interestFreeDays", "minIncome", "creditScore", "welcomeBonus", "rewardRate", "cashback", "airportLounge", "pros", "cons")
                    $csvLines = @(($headers -join ","))
                    
                    foreach ($c in $cards) {
                        $rowVals = @()
                        foreach ($h in $headers) {
                            $val = $c.$h
                            if ($null -eq $val) { $val = "" }
                            $valStr = $val.ToString().Replace('"', '""')
                            $rowVals += "`"$valStr`""
                        }
                        $csvLines += ($rowVals -join ",")
                    }
                    
                    $csvText = $csvLines -join "`r`n"
                    $response.ContentType = "text/csv"
                    $response.AddHeader("Content-Disposition", "attachment; filename=credit_cards_export.csv")
                    $csvBytes = [System.Text.Encoding]::UTF8.GetBytes($csvText)
                    $response.ContentLength64 = $csvBytes.Length
                    $response.OutputStream.Write($csvBytes, 0, $csvBytes.Length)
                    $response.Close()
                    continue
                }
            }

            # ── 9. ADMIN ANALYTICS ──
            elseif ($urlPath -eq "/api/admin/analytics") {
                if ($method -eq "GET") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $posts = ConvertFrom-Json (Get-DbFile "posts")
                        $users = ConvertFrom-Json (Get-DbFile "users")
                        $comments = ConvertFrom-Json (Get-DbFile "comments")
                        $subscribers = ConvertFrom-Json (Get-DbFile "subscribers")
                        
                        $totalViews = 0
                        $totalLikes = 0
                        $posts | ForEach-Object {
                            $totalViews += $_.views
                            $totalLikes += $_.likes
                        }
                        
                        $analytics = @{
                            totalPosts = $posts.Length
                            publishedPosts = ($posts | Where-Object { $_.status -eq "Published" }).Length
                            draftPosts = ($posts | Where-Object { $_.status -eq "Draft" }).Length
                            totalUsers = $users.Length
                            totalComments = $comments.Length
                            totalSubscribers = $subscribers.Length
                            totalViews = $totalViews
                            totalLikes = $totalLikes
                        }
                        Send-JsonResponse $response 200 $analytics
                    }
                }
            }
            # ── 11. LOANS CONFIG API ──
            elseif ($urlPath -eq "/api/admin/loans") {
                if ($method -eq "GET") {
                    $loans = Get-DbFile "loans" "{`"home`":8.5,`"personal`":10.5,`"auto`":9.0,`"student`":8.0}"
                    Send-JsonResponseString $response 200 $loans
                }
                elseif ($method -eq "POST") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        Save-DbFile "loans" $body
                        Send-JsonResponseString $response 200 $body
                    }
                }
            }
            # ── 12. INVESTING CONTENT API ──
            elseif ($urlPath -eq "/api/admin/investing") {
                if ($method -eq "GET") {
                    $investData = Get-DbFile "investing" "[]"
                    Send-JsonResponseString $response 200 $investData
                }
                elseif ($method -eq "POST" -or $method -eq "PUT") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $items = ConvertFrom-Json (Get-DbFile "investing" "[]")
                        $item = ConvertFrom-Json $body
                        if ($method -eq "POST") {
                            $item.id = "inv-" + [Guid]::NewGuid().ToString().Substring(0, 8)
                            $items += $item
                        } else {
                            for ($idx = 0; $idx -lt $items.Count; $idx++) {
                                if ($items[$idx].id -eq $item.id) {
                                    $items[$idx] = $item
                                    break
                                }
                            }
                        }
                        Save-DbFile "investing" (ConvertTo-Json $items -Depth 5 -Compress)
                        Send-JsonResponse $response 200 $item
                    }
                }
                elseif ($method -eq "DELETE") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $itemId = $request.QueryString["id"]
                        $items = ConvertFrom-Json (Get-DbFile "investing" "[]")
                        $filtered = $items | Where-Object { $_.id -ne $itemId }
                        Save-DbFile "investing" (ConvertTo-Json $filtered -Depth 5 -Compress)
                        Send-JsonResponse $response 200 @{ success = $true }
                    }
                }
            }
            # ── 13. ADVANCED ANALYTICS DETAILS ──
            elseif ($urlPath -eq "/api/admin/analytics/details") {
                if ($method -eq "GET") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $details = @{
                            countries = @(
                                @{ code = "IN"; name = "India"; views = 1540 }
                                @{ code = "US"; name = "United States"; views = 820 }
                                @{ code = "UK"; name = "United Kingdom"; views = 310 }
                            )
                            devices = @(
                                @{ name = "Mobile"; pct = 58 }
                                @{ name = "Desktop"; pct = 36 }
                                @{ name = "Tablet"; pct = 6 }
                            )
                            searches = @(
                                "SIP return formula", "Best cashback credit card", "EMI calculator", "P/E ratio valuation"
                            )
                            calcsUsage = @(
                                @{ name = "SIP Compounding"; count = 284 }
                                @{ name = "EMI Mortgage"; count = 192 }
                                @{ name = "Loan Payoff"; count = 154 }
                                @{ name = "Interest Charge"; count = 92 }
                            )
                            activities = @(
                                @{ log = "Super Admin logged in from Bangalore, IN"; time = "Just now" }
                                @{ log = "CSV Credit Cards import triggered successfully"; time = "15 mins ago" }
                                @{ log = "New user subscriber registered: s**@gmail.com"; time = "1 hour ago" }
                                @{ log = "Newsletter campaign 'Weekly Digest' broadcast simulated"; time = "3 hours ago" }
                            )
                        }
                        Send-JsonResponse $response 200 $details
                    }
                }
            }
            # ── 14. USERS DIRECTORY API ──
            elseif ($urlPath -eq "/api/admin/users") {
                if ($method -eq "GET") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $users = Get-DbFile "users"
                        Send-JsonResponseString $response 200 $users
                    }
                }
                elseif ($method -eq "PUT") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $updateReq = ConvertFrom-Json $body
                        $users = ConvertFrom-Json (Get-DbFile "users")
                        for ($idx = 0; $idx -lt $users.Count; $idx++) {
                            if ($users[$idx].email -eq $updateReq.email) {
                                $users[$idx].role = $updateReq.role
                                break
                            }
                        }
                        Save-DbFile "users" (ConvertTo-Json $users -Depth 5 -Compress)
                        Send-JsonResponse $response 200 @{ success = $true }
                    }
                }
            }
            # ── 15. SEO SETTINGS API ──
            elseif ($urlPath -eq "/api/admin/seo") {
                if ($method -eq "GET") {
                    $seo = Get-DbFile "seo" "{`"title`":`"FinVest Hub - Digital Wealth Engine`",`"desc`":`"Educational investing platform`",`"robots`":`"User-agent: *\nAllow: /`",`"redirects`":[]}"
                    Send-JsonResponseString $response 200 $seo
                }
                elseif ($method -eq "POST") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        Save-DbFile "seo" $body
                        Send-JsonResponseString $response 200 $body
                    }
                }
            }
            # ── 16. SYSTEM BACKUP ──
            elseif ($urlPath -eq "/api/admin/backup") {
                if ($method -eq "GET") {
                    if ($null -eq $currentUser -or @("Super Admin", "Admin") -notcontains $currentUser.role) {
                        Send-JsonResponse $response 403 @{ error = "Forbidden." }
                    } else {
                        $backup = @{
                            users = ConvertFrom-Json (Get-DbFile "users")
                            posts = ConvertFrom-Json (Get-DbFile "posts")
                            comments = ConvertFrom-Json (Get-DbFile "comments")
                            subscribers = ConvertFrom-Json (Get-DbFile "subscribers")
                            cards = ConvertFrom-Json (Get-DbFile "cards")
                            glossary = ConvertFrom-Json (Get-DbFile "glossary")
                            settings = ConvertFrom-Json (Get-DbFile "settings")
                        }
                        Send-JsonResponse $response 200 $backup
                    }
                }
            }
            else {
                Send-JsonResponse $response 404 @{ error = "Endpoint not found." }
            }
        } catch {
            Send-JsonResponse $response 500 @{ error = "Server processing error: $_" }
        }
        continue
    }

    # Static File Server
    $filePath = $urlPath
    if ($filePath -eq "/") { $filePath = "/index.html" }
    
    $fullPath = Join-Path $root $filePath.Replace("/", "\")
    
    if (Test-Path $fullPath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($fullPath)
        $response.ContentType = Get-MimeType $ext
        
        try {
            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } catch {
            $response.StatusCode = 500
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("500 Internal Server Error: $_")
            $response.ContentLength64 = $errBytes.Length
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
    } else {
        # SPA routing fallback
        $indexHtmlPath = Join-Path $root "index.html"
        if (Test-Path $indexHtmlPath -PathType Leaf) {
            $response.ContentType = "text/html; charset=utf-8"
            $bytes = [System.IO.File]::ReadAllBytes($indexHtmlPath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found")
            $response.ContentLength64 = $errBytes.Length
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
    }
    
    $response.Close()
}
