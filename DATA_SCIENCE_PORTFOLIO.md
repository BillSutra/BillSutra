# BillSutra: Data Science & Analytics Portfolio
*A specialized assessment of data-driven features for academic and professional presentation.*

---

## 1. Executive Summary
This project transforms a standard billing application into an **Intelligent Business ERP**. As a Data Science student, I implemented four key analytical pillars: **Predictive Maintenance (Inventory)**, **Customer Behavioral Segmentation (CLV)**, **Risk Mitigation (Churn Prediction)**, and **Strategic Forecasting (Sales & Profit)**.

---

## 2. Core Models & Methodologies

### A. Customer Churn Prediction (Predictive Risk Modeling)
*   **Objective**: Predict the probability of a customer stopping their purchases.
*   **Model Type**: Weighted Heuristic Scoring (Probabilistic approach).
*   **Feature Engineering**:
    *   `Recency`: Days since last purchase (normalized 0-1 over 365 days).
    *   `Frequency`: Purchase frequency per day (normalized against user population).
    *   `Engagement Trend`: A calculated "Drop Score" comparing order volume in the most recent 30 days vs. the preceding 30 days.
*   **Scoring Logic**:
    ```python
    Probability = (Recency * 0.4) + ((1 - Frequency) * 0.3) + (EngagementDrop * 0.3)
    ```
*   **Classification**:
    *   `High Risk`: Probability ≥ 70%
    *   `Medium Risk`: Probability ≥ 40%
    *   `Low Risk`: Probability < 40%

### B. Customer Lifetime Value (CLV) Analytics
*   **Objective**: Segment the customer base to prioritize high-value relationships.
*   **Model Type**: Multi-dimensional Composite Scoring (LTV-F-A-R Model).
*   **Feature Engineering**:
    *   `LTV`: Total lifetime revenue.
    *   `Frequency`: Total orders / Customer lifetime days.
    *   `AOV`: Average Order Value.
    *   `Recency`: Time-decay weighted activity.
*   **Normalization**: Min-Max Scaling across the active user base.
*   **Weighting Matrix**:
    *   Lifetime Value (40%)
    *   Frequency (25%)
    *   Avg Order Value (20%)
    *   Recency (15%)
*   **Segmentation**: Percentile-based classification (Top 30% as "Premium", 30-70% as "Regular").

### C. Inventory Demand & Stockout Prediction
*   **Objective**: Automate supply chain management by predicting "Days Until Out of Stock".
*   **Model Type**: Rolling Average Demand Forecasting.
*   **Methodology**:
    1.  **Daily Velocity**: Computes the rolling 30-day sum of unit sales for every SKU.
    2.  **Stockout Horizon**: `Current_Stock / Daily_Velocity`.
    3.  **Lead Time replenishment**: Recommends reorder quantities based on a 14-day safety stock buffer: `(Velocity * 14) - Current_Stock`.
*   **Risk Leveling**: Immediate notification for products with < 3 days of runway.

### D. Time-Series Sales Forecasting
*   **Objective**: Provide 3-month forward-looking visibility into revenue.
*   **Model Type**: 3-Month Simple Moving Average (SMA).
*   **Methodology**:
    *   Aggregates net revenue (Sales - Tax) into monthly buckets.
    *   Implements a sliding window average to predict sequential growth/decline.
    *   Filters by payment status (`PAID`, `PARTIAL`, `UNPAID`) to ensure data integrity.

---

## 3. Data Engineering & Visualization

### Tech Stack for Data Science:
*   **Data Retrieval**: Complex PostgreSQL aggregations using Prisma ORM.
*   **Processing**: Server-side TypeScript for real-time statistical computation.
*   **Visualization**: **Recharts v3.8** with custom implementations for:
    *   Linear gradients for trend visualization.
    *   Custom tooltips for multi-series breakdown.
    *   Interactive legends and baseline anchors (y=0 lines).

### Database Design for Analytics:
*   Utilized **Composite Indexes** on `user_id` and `sale_date` to ensure O(log n) retrieval for large-scale transaction datasets.
*   Implemented **Materialized-style Logic** (via complex query joins) to compute Supplier LTV and Customer Retention metrics on-the-fly without heavy DB overhead.

---

## 4. Business Impact (The "So-What?")
*   **Reduced Revenue Leakage**: Churn alerts allow businesses to launch retention campaigns *before* a customer is lost.
*   **Optimized Working Capital**: Inventory alerts prevent over-stocking of slow-moving goods and stockouts of high-velocity items.
*   **Strategic Growth**: CLV insights identify which customers deserve loyalty rewards or bulk discounts.
*   **Cash Flow Visibility**: Integrated profit analytics allow business owners to plan for expenses based on actual received payments vs. projected revenue.

---

## 5. Presentation Talking Points for a Data Scientist
1.  *"Instead of just reporting past sales, I built a predictive layer that calculates customer risk in real-time."*
2.  *"I solved the 'data sparsity' problem for small businesses by using weighted heuristic models that perform better than deep learning on smaller, irregular datasets."*
3.  *"The dashboard doesn't just show data; it performs feature engineering on-the-fly to calculate composite loyalty scores (CLV) and inventory velocity."*
4.  *"I implemented data normalization (Min-Max scaling) to ensure that high-ticket items don't skew the frequency scores of high-volume, low-cost clients."*
