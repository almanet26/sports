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

export default function SubscriptionPage() {
  const { user } = useAuthStore();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<number | null>(null);

  useEffect(() => {
    plansApi.list().then((res: any) => {
      setPlans(res.data);
    });
  }, []);

  const handleUpgrade = async (planId: number) => {
    if (!user) return;

    await subscriptionApi.subscribe(user.id, planId);

    alert('Subscription activated');
    setCurrentPlan(planId);
  };

  return (
    <div className="text-white space-y-8">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 border border-white/20"
      >
        <h1 className="text-3xl font-bold gradient-text">Subscription Plans</h1>
        <p className="text-white/70 mt-1">Choose the perfect plan for your needs</p>
      </motion.div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan, index) => {

          const isCurrentPlan = plan.id === currentPlan;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="glass rounded-3xl p-6 border border-white/20"
            >

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>

                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold">₹{plan.monthly_price}</span>
                  <span className="text-white/60 text-sm">/month</span>
                </div>

                <p className="text-white/60 text-sm mt-2">
                  Yearly: ₹{plan.yearly_price}
                </p>
              </div>

              <div className="text-sm text-white/80 mb-6">
                {plan.features}
              </div>

              {/* Buttons */}
              {isCurrentPlan ? (
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 font-semibold"
                >
                  Active Plan
                </button>

              ) : user?.role !== "ADMIN" ? (

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleUpgrade(plan.id)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold"
                >
                  Subscribe
                </motion.button>

              ) : (

                <button
                  disabled
                  className="w-full py-3 rounded-xl glass border border-white/20 text-white/60 font-semibold"
                >
                  Admin View
                </button>

              )}

            </motion.div>
          );
        })}
      </div>

    </div>
  );
}