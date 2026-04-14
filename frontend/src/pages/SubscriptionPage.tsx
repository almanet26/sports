import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { plansApi, subscriptionApi } from '../lib/api';

interface Plan {
  id: number;
  name: string;
  monthly_price: number;
  yearly_price: number;
  features: string;
}

function getPlanStyle(index: number) {
  const styles = [
    { gradient: 'from-blue-500 to-cyan-500', icon: 'fa-bolt', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { gradient: 'from-purple-500 to-pink-500', icon: 'fa-crown', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { gradient: 'from-yellow-500 to-orange-500', icon: 'fa-gem', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { gradient: 'from-green-500 to-emerald-500', icon: 'fa-shield-alt', badge: 'bg-green-500/20 text-green-400 border-green-500/30' },
  ];
  return styles[index % styles.length];
}

export default function SubscriptionPage() {
  const { user } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<number | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    const load = async () => {
      try {
        const [plansRes, subRes] = await Promise.all([
          plansApi.list(),
          user ? subscriptionApi.getUserSubscription(user.id) : Promise.resolve({ data: null }),
        ]);
        setPlans(plansRes.data || []);
        if (subRes.data?.plan_id) setActivePlanId(subRes.data.plan_id);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleSubscribe = async (planId: number) => {
    if (!user) return;
    setSubscribing(planId);
    try {
      await subscriptionApi.subscribe(user.id, planId);
      setActivePlanId(planId);
    } catch (e) {
      console.error(e);
    } finally {
      setSubscribing(null);
    }
  };

  const parseFeatures = (features: string) =>
    features.split(',').map(f => f.trim()).filter(Boolean);

  const activePlan = plans.find(p => p.id === activePlanId);

  return (
    <div className="text-white space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 border border-white/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-crown text-yellow-400"></i>
              Subscription Plans
            </h1>
            <p className="text-white/60 mt-1 text-sm">Choose the plan that fits your game</p>
          </div>
          {/* Billing toggle */}
          <div className="flex items-center gap-1 glass rounded-xl p-1 border border-white/10 self-start">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billingCycle === 'monthly' ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' : 'text-white/50 hover:text-white'}`}
            >Monthly</button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billingCycle === 'yearly' ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' : 'text-white/50 hover:text-white'}`}
            >
              Yearly
              <span className="ml-1 text-xs text-green-400">Save 20%</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Current plan banner */}
      {activePlan && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-4 border border-green-500/30 bg-green-500/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <i className="fas fa-check-circle text-green-400"></i>
          </div>
          <div>
            <p className="font-semibold text-green-400">Active Plan: {activePlan.name}</p>
            <p className="text-xs text-white/50">
              ₹{billingCycle === 'monthly' ? activePlan.monthly_price + '/month' : activePlan.yearly_price + '/year'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Plans grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <div className="glass rounded-3xl p-16 border border-white/20 text-center">
          <i className="fas fa-crown text-5xl text-white/20 mb-4"></i>
          <p className="text-white/60 text-lg">No plans available yet</p>
          <p className="text-white/40 text-sm mt-1">Check back soon — the admin is setting up plans</p>
        </div>
      ) : (
        <div className={`grid gap-6 ${plans.length === 1 ? 'max-w-sm mx-auto' : plans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {plans.map((plan, index) => {
            const style = getPlanStyle(index);
            const isActive = plan.id === activePlanId;
            const price = billingCycle === 'monthly' ? plan.monthly_price : plan.yearly_price;
            const features = parseFeatures(plan.features);
            const isPopular = index === 1 && plans.length >= 3;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative glass rounded-3xl p-6 border transition-all duration-300 flex flex-col ${
                  isActive ? 'border-green-500/50 bg-green-500/5' :
                  isPopular ? 'border-purple-500/50' : 'border-white/20 hover:border-white/30'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-xs font-bold text-white">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    {isActive && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border mt-1 inline-block bg-green-500/20 text-green-400 border-green-500/30`}>
                        Current Plan
                      </span>
                    )}
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${style.gradient} flex items-center justify-center`}>
                    <i className={`fas ${style.icon} text-white`}></i>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">₹{price}</span>
                    <span className="text-white/50 text-sm">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <p className="text-xs text-green-400 mt-1">
                      ₹{Math.round(plan.yearly_price / 12)}/month billed annually
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-8 flex-1">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                      <i className={`fas fa-check-circle mt-0.5 flex-shrink-0 bg-gradient-to-r ${style.gradient} bg-clip-text text-transparent`}
                        style={{ WebkitBackgroundClip: 'text', color: 'transparent' }}></i>
                      <i className="fas fa-check-circle mt-0.5 flex-shrink-0 text-green-400 text-xs"></i>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isActive ? (
                  <button disabled className="w-full py-3 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 font-semibold">
                    <i className="fas fa-check mr-2"></i>Active Plan
                  </button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={subscribing === plan.id}
                    className={`w-full py-3 rounded-xl bg-gradient-to-r ${style.gradient} text-white font-semibold transition-all disabled:opacity-60`}
                  >
                    {subscribing === plan.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Processing...
                      </span>
                    ) : (
                      <>Get {plan.name}</>
                    )}
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
