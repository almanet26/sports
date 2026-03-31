import { useEffect, useState } from "react";
import { plansApi } from "../lib/api";

export default function AdminPlansPage() {

  const [plans, setPlans] = useState<any[]>([]);

  const [form, setForm] = useState({
    name: "",
    monthly_price: "",
    yearly_price: "",
    features: ""
  });

  const fetchPlans = () => {
    plansApi.list().then((res: any) => {
      setPlans(res.data);
    });
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleDelete = async (id: number) => {
    await plansApi.delete(id);
    fetchPlans();
  };

  const handleCreate = async () => {
    await plansApi.create({
      name: form.name,
      monthly_price: Number(form.monthly_price),
      yearly_price: Number(form.yearly_price),
      features: form.features
    });

    setForm({
      name: "",
      monthly_price: "",
      yearly_price: "",
      features: ""
    });

    fetchPlans();
  };

  return (
    <div>

      <h2 className="text-xl mb-4">Subscription Plans</h2>

      {/* CREATE PLAN */}
      <div className="mb-6 border p-4">

        <h3>Create Plan</h3>

        <input
          placeholder="Plan name"
          value={form.name}
          onChange={(e)=>setForm({...form,name:e.target.value})}
        />

        <input
          placeholder="Monthly price"
          value={form.monthly_price}
          onChange={(e)=>setForm({...form,monthly_price:e.target.value})}
        />

        <input
          placeholder="Yearly price"
          value={form.yearly_price}
          onChange={(e)=>setForm({...form,yearly_price:e.target.value})}
        />

        <input
          placeholder="Features"
          value={form.features}
          onChange={(e)=>setForm({...form,features:e.target.value})}
        />

        <button
          className="bg-green-600 text-white px-3 py-1 rounded"
          onClick={handleCreate}
        >
          Create Plan
        </button>

      </div>

      {/* PLAN LIST */}
      {plans.map((plan) => (

        <div
          key={plan.id}
          style={{border:"1px solid #ccc",padding:"10px",margin:"10px"}}
        >

          <h3>{plan.name}</h3>

          <p>Monthly: ₹{plan.monthly_price}</p>
          <p>Yearly: ₹{plan.yearly_price}</p>
          <p>{plan.features}</p>

          <button
            className="bg-blue-600 text-white px-3 py-1 rounded mr-2"
            onClick={async()=>{

              const newPrice = prompt("New monthly price");

              await plansApi.update(plan.id,{
                name:plan.name,
                monthly_price:Number(newPrice),
                yearly_price:plan.yearly_price,
                features:plan.features
              });

              fetchPlans();
            }}
          >
            Update
          </button>

          <button
            className="bg-red-600 text-white px-3 py-1 rounded"
            onClick={()=>handleDelete(plan.id)}
          >
            Delete
          </button>

        </div>

      ))}

    </div>
  );
}