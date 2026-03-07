import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface SubscriptionTier {
  name: string;
  price: number;
  features: {
    video_uploads: number;
    analysis_per_month: number;
    storage_gb: number;
    support: string;
  };
}

export default function SubscriptionPage() {
  const user = useAuthStore((state) => state.user);

  const tiers = [
    {
      name: 'BASIC',
      price: 0,
      features: {
        video_uploads: 5,
        analysis_per_month: 10,
        storage_gb: 2,
        support: 'Community'
      }
    },
    {
      name: 'SILVER',
      price: 29.99,
      features: {
        video_uploads: 20,
        analysis_per_month: 50,
        storage_gb: 10,
        support: 'Email'
      }
    },
    {
      name: 'GOLD',
      price: 49.99,
      features: {
        video_uploads: -1,
        analysis_per_month: -1,
        storage_gb: 50,
        support: 'Priority'
      }
    }
  ];

  const currentTier = 'BASIC';

  const handleUpgrade = (tier: string) => {
    alert(`Upgrade to ${tier} - Payment integration coming soon!`);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold gradient-text mb-2">Subscription Plans</h1>
        <p className="text-white/60">Choose the plan that fits your needs</p>
      </motion.div>

      {/* Current Subscription */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 mb-8 border border-white/20"
      >
        <h2 className="text-2xl font-bold mb-4">Current Plan: {currentTier}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-white/60 text-sm">Video Uploads</p>
            <p className="text-2xl font-bold">5</p>
          </div>
          <div>
            <p className="text-white/60 text-sm">Analysis/Month</p>
            <p className="text-2xl font-bold">10</p>
          </div>
          <div>
            <p className="text-white/60 text-sm">Storage</p>
            <p className="text-2xl font-bold">2 GB</p>
          </div>
          <div>
            <p className="text-white/60 text-sm">Support</p>
            <p className="text-2xl font-bold">Community</p>
          </div>
        </div>
      </motion.div>

      {/* Upgrade Options */}
      <h2 className="text-2xl font-bold mb-6">Available Plans</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map((tier, index) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`glass rounded-2xl p-6 border ${
              currentTier === tier.name
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-white/20'
            }`}
          >
            <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
            <p className="text-4xl font-bold mb-4">
              ${tier.price}
              <span className="text-lg text-white/60">/mo</span>
            </p>
            
            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-400"></i>
                <span>{tier.features.video_uploads === -1 ? 'Unlimited' : tier.features.video_uploads} video uploads</span>
              </li>
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-400"></i>
                <span>{tier.features.analysis_per_month === -1 ? 'Unlimited' : tier.features.analysis_per_month} analyses/month</span>
              </li>
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-400"></i>
                <span>{tier.features.storage_gb} GB storage</span>
              </li>
              <li className="flex items-center gap-2">
                <i className="fas fa-check text-green-400"></i>
                <span>{tier.features.support} support</span>
              </li>
            </ul>

            {currentTier === tier.name ? (
              <button
                disabled
                className="w-full py-3 rounded-xl bg-white/10 text-white/50 cursor-not-allowed"
              >
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade(tier.name)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all"
              >
                {tier.price === 0 ? 'Downgrade' : 'Upgrade'}
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
