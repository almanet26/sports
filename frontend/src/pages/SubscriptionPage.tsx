import { useState } from 'react';
import { motion } from 'framer-motion';

type PlanType = 'BASIC' | 'SILVER' | 'GOLD';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: PlanType;
  name: string;
  price: string;
  period: string;
  description: string;
  features: PlanFeature[];
  gradient: string;
  icon: string;
  popular?: boolean;
}

export default function SubscriptionPage() {
  const [currentPlan] = useState<PlanType>('BASIC'); // Default plan for new users

  const plans: Plan[] = [
    {
      id: 'BASIC',
      name: 'Basic',
      price: 'Free',
      period: 'forever',
      description: 'Perfect for getting started',
      gradient: 'from-gray-500 to-gray-600',
      icon: 'fas fa-user',
      features: [
        { text: 'Access to public highlights', included: true },
        { text: 'Basic video analysis', included: true },
        { text: 'Community features', included: true },
        { text: 'Limited video uploads (5/month)', included: true },
        { text: 'Advanced AI insights', included: false },
        { text: 'Priority support', included: false },
        { text: 'Custom reports', included: false },
      ],
    },
    {
      id: 'SILVER',
      name: 'Silver',
      price: '$19',
      period: '/month',
      description: 'For serious athletes',
      gradient: 'from-gray-400 via-gray-300 to-gray-400',
      icon: 'fas fa-medal',
      popular: true,
      features: [
        { text: 'Everything in Basic', included: true },
        { text: 'Unlimited video uploads', included: true },
        { text: 'Advanced AI insights', included: true },
        { text: 'Performance tracking', included: true },
        { text: 'Email support', included: true },
        { text: 'Custom reports', included: false },
        { text: 'Priority processing', included: false },
      ],
    },
    {
      id: 'GOLD',
      name: 'Gold',
      price: '$49',
      period: '/month',
      description: 'Professional level features',
      gradient: 'from-yellow-400 via-yellow-500 to-yellow-600',
      icon: 'fas fa-crown',
      features: [
        { text: 'Everything in Silver', included: true },
        { text: 'Priority processing', included: true },
        { text: 'Custom PDF reports', included: true },
        { text: 'Advanced analytics dashboard', included: true },
        { text: 'Priority support (24/7)', included: true },
        { text: 'Team collaboration tools', included: true },
        { text: 'API access', included: true },
      ],
    },
  ];

  const handleUpgrade = (planId: PlanType) => {
    // TODO: Implement payment integration
    console.log(`Upgrading to ${planId}`);
    alert(`Upgrade to ${planId} plan - Payment integration coming soon!`);
  };

  return (
    <div className="text-white space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 border border-white/20"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center">
            <i className="fas fa-star text-white text-2xl"></i>
          </div>
          <div>
            <h1 className="text-3xl font-bold gradient-text">Subscription Plans</h1>
            <p className="text-white/70 mt-1">Choose the perfect plan for your needs</p>
          </div>
        </div>
      </motion.div>

      {/* Current Plan Badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-4 border border-white/20"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="fas fa-check-circle text-green-400 text-xl"></i>
            <div>
              <p className="text-sm text-white/60">Current Plan</p>
              <p className="font-semibold text-lg">{currentPlan} Plan</p>
            </div>
          </div>
          <span className="px-4 py-2 rounded-full bg-green-500/20 text-green-400 text-sm border border-green-500/30">
            Active
          </span>
        </div>
      </motion.div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan, index) => {
          const isCurrentPlan = plan.id === currentPlan;
          const canUpgrade = !isCurrentPlan && plan.id !== 'BASIC';

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className={`relative glass rounded-3xl p-6 border transition-all duration-300 ${
                isCurrentPlan
                  ? 'border-green-500/50 shadow-lg shadow-green-500/20'
                  : plan.popular
                  ? 'border-blue-500/50 shadow-lg shadow-blue-500/20'
                  : 'border-white/20 hover:border-white/30'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-semibold">
                    Current Plan
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <div
                  className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-r ${plan.gradient} flex items-center justify-center mb-4 ${
                    plan.id === 'SILVER' ? 'shadow-lg shadow-gray-400/50' : ''
                  } ${plan.id === 'GOLD' ? 'shadow-lg shadow-yellow-500/50' : ''}`}
                >
                  <i className={`${plan.icon} text-white text-2xl`}></i>
                </div>
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-white/60 text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-white/60 text-sm">{plan.period}</span>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <i
                      className={`fas ${
                        feature.included ? 'fa-check-circle text-green-400' : 'fa-times-circle text-white/30'
                      } text-sm mt-0.5`}
                    ></i>
                    <span className={`text-sm ${feature.included ? 'text-white/80' : 'text-white/40'}`}>
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              {isCurrentPlan ? (
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 font-semibold cursor-not-allowed"
                >
                  <i className="fas fa-check mr-2"></i>
                  Active Plan
                </button>
              ) : canUpgrade ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleUpgrade(plan.id)}
                  className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
                      : `bg-gradient-to-r ${plan.gradient} text-white shadow-lg hover:shadow-xl`
                  }`}
                >
                  <i className="fas fa-arrow-up mr-2"></i>
                  Upgrade to {plan.name}
                </motion.button>
              ) : (
                <button
                  disabled
                  className="w-full py-3 rounded-xl glass border border-white/20 text-white/60 font-semibold cursor-not-allowed"
                >
                  Current Plan
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* FAQ Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-3xl p-6 border border-white/20"
      >
        <h2 className="text-xl font-bold mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div>
            <p className="font-medium text-white/90 mb-1">Can I change my plan anytime?</p>
            <p className="text-sm text-white/60">
              Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
            </p>
          </div>
          <div>
            <p className="font-medium text-white/90 mb-1">What payment methods do you accept?</p>
            <p className="text-sm text-white/60">
              We accept all major credit cards, debit cards, and digital payment methods.
            </p>
          </div>
          <div>
            <p className="font-medium text-white/90 mb-1">Is there a free trial?</p>
            <p className="text-sm text-white/60">
              The Basic plan is free forever. You can upgrade to paid plans anytime to unlock premium features.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
