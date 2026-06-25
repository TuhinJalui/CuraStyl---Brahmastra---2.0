# CuraStyl ✨

> **AI-Enabled Hyperlocal Salon Marketplace, AR-Powered Virtual Try-On & Intelligent Styling Assistant**

CuraStyl is a premium, next-generation Web application designed to revolutionize the beauty and grooming ecosystem. It acts as a double-sided platform: providing customers with hyperlocal salon discovery, AI-guided styling advice, and browser-based real-time 3D Virtual Try-On, while equipping salon owners with a robust business dashboard, booking scheduler, review analytics, and client management tools.

Developed by **Team Brahmastra 2.O** at **Fr. Conceicao Rodrigues College of Engineering (FRCRCE), Bandra**.

---

## 🚀 Key Features

### 1. 💇‍♂️ AR-Powered Virtual Try-On (WebAR)
* **Real-time Camera Feed**: Client-side face mapping using **MediaPipe Face Mesh** and **TensorFlow.js** tracking 468 3D landmark coordinates on the user's face.
* **3D Hairstyle Projection**: Responsive model loading (.glb/.gltf) dynamically overlaying hairstyles and makeup onto the webcam stream using **Three.js** and **React Three Fiber**.
* **Targeted Catalogs**: Automatic gender-based filtering (Men's vs Women's styles) triggered by system-level image analysis or user preferences.

### 2. 💬 AuraAI — Intelligent Styling Assistant
* **Context-Aware Recommendations**: High-fidelity AI consultation bot powered by the **Google Gemini 1.5** LLM.
* **Dynamic Visual Search**: Extracts query keywords and searches the web in real-time, fetching reference styling images directly into an interactive, inline swipeable image carousel.
* **Smart Navigation**: Automatically suggests relevant application links (e.g. Try-On paths, salon booking links) matching the customer's conversational context.

### 3. 🏪 Hyperlocal Discovery & Real-Time Booking
* **Sub-Locality Filtering**: Geolocation-aware marketplace lists (covering Bandra, Andheri, Powai, Juhu, etc.) matching budgets, ratings, and specific treatment categories.
* **Real-Time Calendar Blockers**: Centralized scheduling ledger preventing double bookings and providing instant scheduling feedback.

### 4. 💳 Unified Checkout & simulated Payments
* **Redemption Engine**: Integrates **GlamPoints** (loyalty program) directly into the checkout ledger.
* **Payment Simulators**: Mimics UPI and card routing (based on Razorpay interface) to generate invoice receipts.
* **PDF Receipt Downloader**: Programmatic receipt layout compilation downloadable instantly as a PDF file using the **jsPDF** engine.

### 5. 📊 Salon Owner Dashboard Console
* **Business Analytics**: Live tracking of booking states, reservation counts, and total revenue.
* **Operational Control**: Confirm, complete, or reschedule bookings on a live scheduler console.
* **Review Center**: Full visibility over customer review records, displaying reviewer identities (names & avatars) to business owners.

### 6. 🔒 Enterprise Route Security
* **Access Segregation**: Strict **Next.js middleware** intercepts role routes. Salon owners are barred from booking paths, and customers cannot access dashboard backends.
* **Row-Level Security (RLS)**: PostgreSQL policy segregation inside Supabase secures individual client records.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend UI** | Next.js 15 (React 19), Tailwind CSS, Framer Motion, Lucide Icons |
| **Application Logic** | TypeScript, Next.js Server Actions, Route Handlers (API) |
| **Database / Auth** | Supabase DB (PostgreSQL), Supabase Auth Client Cookies |
| **AI Core** | Google Generative AI (Gemini 1.5 API) |
| **AR Core** | MediaPipe (FaceMesh), TensorFlow.js, Three.js, React Three Fiber |
| **Integrations** | jsPDF, Razorpay Client SDK Simulation |

---

## 📂 Database Schema Overview

The database leverages relational PostgreSQL tables inside Supabase with cascade deletions and strict constraints:
* **`profiles`**: User metadata, role declarations (`customer` vs `salon_owner`), and profile avatar URLs.
* **`salons`**: Business details, locations, contact info, rating stats, and cover image references.
* **`services`**: Salon treatment catalogs, price tiers, durations, and gender tags.
* **`bookings`**: Central transactions mapping clients, salon calendars, specific services, status tags, and payments.
* **`reviews`**: Ratings ledger connecting customer profiles, comments, and target salons.
* **`glam_points`**: Ledger recording user points balance and redemption logs.

---

## ⚙️ Installation & Local Setup

### Prerequisites
* **Node.js** (v18.x or later)
* **npm** (v9.x or later)
* **Supabase** account and project instance

### 1. Clone the Repository
```bash
git clone https://github.com/TuhinJalui/CuraStyl---Brahmastra---2.0.git
cd CuraStyl---Brahmastra---2.0
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory and define the following variables:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google Gemini API Keys (Supports Rotation)
GEMINI_API_KEY_1=your_gemini_key_1
GEMINI_API_KEY_2=your_gemini_key_2

# Image Search Integration Keys
PEXELS_API_KEY=your_pexels_key
GOOGLE_CSE_KEY=your_google_custom_search_key
GOOGLE_CSE_CX=your_google_custom_search_cx
```

### 3. Initialize Database Setup
Execute the SQL migrations found under the `/supabase` folder inside your Supabase SQL Editor:
1. Run `supabase/FIX_PAYMENTS_TABLE.sql`
2. Run `supabase/FIX_GLAMPOINTS_AND_PLANS.sql`
3. Run `supabase/COMPLETE_PAYMENT_FIX.sql`

### 4. Install Dependencies
```bash
npm install
```

### 5. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 👥 The Team: Brahmastra 2.O
Developed with ❤️ by:
* **Shreyas Mahajan** — Fr. Conceicao Rodrigues College of Engineering
* **Tuhin Jalui** — Fr. Conceicao Rodrigues College of Engineering
* **Vivan Shetty** — Fr. Conceicao Rodrigues College of Engineering

**College**: Fr. Conceicao Rodrigues College of Engineering (FRCRCE), Bandra, Mumbai.

---

## 📄 License
This project is private and proprietary. All rights reserved.
