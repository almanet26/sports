import { useState } from 'react';
import { Check, X } from 'lucide-react';

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  features: string[];
  isActive: boolean;
}

export const PlayerSubscriptionDashboard = () => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionTier[]>([
    {
      id: 'basic',
      name: 'Basic',
      price: 0,
      features: ['View basic stats', 'Limited video uploads', 'Standard analytics'],
      isActive: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 9.99,
      features: ['Advanced analytics', 'Unlimited uploads', 'Priority support', 'Custom reports'],
      isActive: false,
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 19.99,
      features: ['All Pro features', 'AI-powered insights', 'Team collaboration', 'API access'],
      isActive: false,
    },
  ]);

  const handleUpgrade = (tierId: string) => {
    setSubscriptions(
      subscriptions.map((sub) =>
        sub.id === tierId ? { ...sub, isActive: true } : { ...sub, isActive: false }
      )
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">Subscription Plans</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {subscriptions.map((tier) => (
          <div
            key={tier.id}
            className={`rounded-lg shadow-lg p-6 ${
              tier.isActive ? 'bg-blue-50 border-2 border-blue-500' : 'bg-white border border-gray-200'
            }`}
          >
            <h2 className="text-2xl font-bold mb-2">{tier.name}</h2>
            <p className="text-3xl font-bold text-blue-600 mb-4">
              ${tier.price}
              <span className="text-sm text-gray-600">/month</span>
            </p>
            <ul className="mb-6 space-y-3">
              {tier.features.map((feature, idx) => (
                <li key={idx} className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-2" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleUpgrade(tier.id)}
              disabled={tier.isActive}
              className={`w-full py-2 rounded-lg font-semibold transition ${
                tier.isActive
                  ? 'bg-green-500 text-white cursor-default'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {tier.isActive ? 'Current Plan' : 'Upgrade'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
