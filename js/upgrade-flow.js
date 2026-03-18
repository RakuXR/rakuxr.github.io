/**
 * Raku Pro Upgrade Flow — reusable component.
 *
 * Usage:
 *   <script src="js/upgrade-flow.js"></script>
 *
 * This script:
 * 1. Checks user's usage via the API
 * 2. Shows an upgrade banner when approaching or exceeding daily limit
 * 3. Provides handleUpgrade() for upgrade button clicks
 * 4. Handles Stripe Checkout redirect flow
 */

(function () {
    'use strict';

    const API_BASE = window.RAKU_API_BASE || 'https://api.raku.games';

    function getAuthToken() {
        return localStorage.getItem('raku_access_token');
    }

    function getUserTier() {
        try {
            const user = JSON.parse(localStorage.getItem('raku_user') || '{}');
            return user.tier || 'free';
        } catch {
            return 'free';
        }
    }

    /**
     * Create and inject the upgrade banner into the page.
     * @param {string} containerId - ID of the element to insert the banner into
     * @param {object} usage - Usage data from the API
     */
    function showUpgradeBanner(containerId, usage) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const remaining = usage.generations_remaining || 0;
        const limit = usage.generations_limit || 10;
        const used = limit - remaining;

        // Don't show if Pro tier or plenty of usage left
        if (usage.tier === 'pro' || usage.tier === 'enterprise') return;
        if (remaining > 3) return;

        let title, message;
        if (remaining === 0) {
            title = 'Daily limit reached';
            message = `You've used all ${limit} generations today. Upgrade to Pro for 100/day with priority queue and high-quality AI.`;
        } else {
            title = `${remaining} generation${remaining === 1 ? '' : 's'} remaining today`;
            message = `You've used ${used} of ${limit} free generations. Upgrade to Pro for 100/day.`;
        }

        const banner = document.createElement('div');
        banner.className = 'raku-upgrade-banner';
        banner.innerHTML = `
            <div class="raku-upgrade-banner-inner">
                <div class="raku-upgrade-banner-text">
                    <strong>${title}</strong>
                    <span>${message}</span>
                </div>
                <a href="pricing.html" class="raku-upgrade-banner-btn">Upgrade to Pro &mdash; $14.99/mo</a>
            </div>
        `;

        // Inject styles if not already present
        if (!document.getElementById('raku-upgrade-styles')) {
            const style = document.createElement('style');
            style.id = 'raku-upgrade-styles';
            style.textContent = `
                .raku-upgrade-banner {
                    margin: 16px 0;
                }
                .raku-upgrade-banner-inner {
                    background: linear-gradient(135deg, rgba(108, 92, 231, 0.15), rgba(163, 136, 255, 0.1));
                    border: 1px solid #6c5ce7;
                    border-radius: 12px;
                    padding: 16px 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                }
                .raku-upgrade-banner-text {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .raku-upgrade-banner-text strong {
                    color: #e8e8f0;
                    font-size: 0.95rem;
                }
                .raku-upgrade-banner-text span {
                    color: #9090b0;
                    font-size: 0.85rem;
                }
                .raku-upgrade-banner-btn {
                    background: linear-gradient(135deg, #6c5ce7, #a388ff);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 700;
                    font-size: 0.85rem;
                    white-space: nowrap;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .raku-upgrade-banner-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 16px rgba(108, 92, 231, 0.4);
                }
                .raku-upgrade-banner.limit-hit .raku-upgrade-banner-inner {
                    border-color: #fd79a8;
                    background: linear-gradient(135deg, rgba(253, 121, 168, 0.12), rgba(108, 92, 231, 0.08));
                }
                @media (max-width: 768px) {
                    .raku-upgrade-banner-inner {
                        flex-direction: column;
                        text-align: center;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        if (remaining === 0) {
            banner.classList.add('limit-hit');
        }

        container.innerHTML = '';
        container.appendChild(banner);
    }

    /**
     * Check usage and show banner if needed.
     * @param {string} containerId - Element ID to insert banner into
     */
    async function checkAndShowBanner(containerId) {
        const token = getAuthToken();
        if (!token) return;

        const tier = getUserTier();
        if (tier === 'pro' || tier === 'enterprise') return;

        try {
            const response = await fetch(`${API_BASE}/api/v1/usage`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) return;

            const usage = await response.json();
            showUpgradeBanner(containerId, usage.today || usage);
        } catch {
            // Silently fail — don't break the page
        }
    }

    /**
     * Initiate Stripe Checkout for Pro upgrade.
     */
    async function handleUpgrade() {
        const token = getAuthToken();
        if (!token) {
            window.location.href = 'index.html#create';
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/v1/billing/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to create checkout session');
            }

            const data = await response.json();
            window.location.href = data.checkout_url;
        } catch (error) {
            console.error('Upgrade error:', error);
            alert('Unable to start checkout. Please try again.');
        }
    }

    // Expose globally
    window.RakuUpgrade = {
        checkAndShowBanner: checkAndShowBanner,
        showUpgradeBanner: showUpgradeBanner,
        handleUpgrade: handleUpgrade,
    };
})();
