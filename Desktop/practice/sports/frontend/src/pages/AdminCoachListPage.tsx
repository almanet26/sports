import React, { useState, useEffect } from 'react';
import { useTheme } from '../components/providers/ThemeProvider';

interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  experience: number;
  verified: boolean;
  status: 'active' | 'inactive' | 'pending';
  joinDate: string;
  students: number;
}

export default function AdminCoachListPage() {
  const { isDark } = useTheme();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [filteredCoaches, setFilteredCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'experience' | 'students' | 'joinDate'>('name');

  useEffect(() => {
    fetchCoaches();
  }, []);

  useEffect(() => {
    filterAndSortCoaches();
  }, [coaches, searchTerm, statusFilter, verificationFilter, sortBy]);

  const fetchCoaches = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/coaches');
      const data = await response.json();
      setCoaches(data);
    } catch (error) {
      console.error('Error fetching coaches:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCoaches = () => {
    let filtered = coaches.filter(coach => {
      const matchesSearch = coach.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           coach.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || coach.status === statusFilter;
      const matchesVerification = verificationFilter === 'all' || 
                                 (verificationFilter === 'verified' ? coach.verified : !coach.verified);
      
      return matchesSearch && matchesStatus && matchesVerification;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'experience':
          return b.experience - a.experience;
        case 'students':
          return b.students - a.students;
        case 'joinDate':
          return new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime();
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    setFilteredCoaches(filtered);
  };

  const handleStatusChange = async (coachId: string, newStatus: string) => {
    try {
      await fetch(`/api/admin/coaches/${coachId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchCoaches();
    } catch (error) {
      console.error('Error updating coach status:', error);
    }
  };

  const handleVerify = async (coachId: string) => {
    try {
      await fetch(`/api/admin/coaches/${coachId}/verify`, { method: 'POST' });
      fetchCoaches();
    } catch (error) {
      console.error('Error verifying coach:', error);
    }
  };

  const handleDelete = async (coachId: string) => {
    if (window.confirm('Are you sure you want to delete this coach?')) {
      try {
        await fetch(`/api/admin/coaches/${coachId}`, { method: 'DELETE' });
        fetchCoaches();
      } catch (error) {
        console.error('Error deleting coach:', error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Coach Management
          </h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Manage all coaches and their verification status
          </p>
        </div>

        <div className={`rounded-lg p-6 mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Search
              </label>
              <input
                type="text"
                placeholder="Name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Verification
              </label>
              <select
                value={verificationFilter}
                onChange={(e) => setVerificationFilter(e.target.value as any)}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="all">All</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={`w-full px-4 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="name">Name</option>
                <option value="experience">Experience</option>
                <option value="students">Students</option>
                <option value="joinDate">Join Date</option>
              </select>
            </div>
          </div>
        </div>

        <div className={`rounded-lg overflow-hidden shadow-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          {loading ? (
            <div className="p-8 text-center">
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Loading coaches...</p>
            </div>
          ) : filteredCoaches.length === 0 ? (
            <div className="p-8 text-center">
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>No coaches found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={isDark ? 'bg-gray-700' : 'bg-gray-100'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Name</th>
                    <th className={`px-6 py-3 text-left text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Email</th>
                    <th className={`px-6 py-3 text-left text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Specialization</th>
                    <th className={`px-6 py-3 text-left text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Experience</th>
                    <th className={`px-6 py-3 text-left text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Students</th>
                    <th className={`px-6 py-3 text-left text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Status</th>
                    <th className={`px-6 py-3 text-left text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Verified</th>
                    <th className={`px-6 py-3 text-left text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCoaches.map((coach) => (
                    <tr key={coach.id} className={`border-t ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <td className={`px-6 py-4 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{coach.name}</td>
                      <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{coach.email}</td>
                      <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{coach.specialization}</td>
                      <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{coach.experience} yrs</td>
                      <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{coach.students}</td>
                      <td className="px-6 py-4 text-sm">
                        <select value={coach.status} onChange={(e) => handleStatusChange(coach.id, e.target.value)} className={`px-2 py-1 rounded text-xs font-medium border-0 ${getStatusColor(coach.status)}`}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="pending">Pending</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${coach.verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {coach.verified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          {!coach.verified && (
                            <button onClick={() => handleVerify(coach.id)} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors">
                              Verify
                            </button>
                          )}
                          <button onClick={() => handleDelete(coach.id)} className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Coaches</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{coaches.length}</p>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Active</p>
            <p className={`text-2xl font-bold text-green-600`}>{coaches.filter(c => c.status === 'active').length}</p>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Verified</p>
            <p className={`text-2xl font-bold text-blue-600`}>{coaches.filter(c => c.verified).length}</p>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Pending</p>
            <p className={`text-2xl font-bold text-yellow-600`}>{coaches.filter(c => c.status === 'pending').length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
