import { useState } from 'react';
import { Check, X, Clock } from 'lucide-react';

interface CoachRequest {
  id: string;
  coachName: string;
  email: string;
  experience: string;
  certification: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedDate: string;
  documents: string[];
}

export const AdminCoachVerification = () => {
  const [requests, setRequests] = useState<CoachRequest[]>([
    {
      id: '1',
      coachName: 'John Smith',
      email: 'john@example.com',
      experience: '10 years',
      certification: 'ICC Level 2',
      status: 'pending',
      submittedDate: '2024-01-15',
      documents: ['certificate.pdf', 'experience_letter.pdf'],
    },
    {
      id: '2',
      coachName: 'Sarah Johnson',
      email: 'sarah@example.com',
      experience: '8 years',
      certification: 'BCCI Certified',
      status: 'pending',
      submittedDate: '2024-01-14',
      documents: ['certificate.pdf', 'id_proof.pdf'],
    },
  ]);

  const handleApprove = (id: string) => {
    setRequests(
      requests.map((req) =>
        req.id === id ? { ...req, status: 'approved' } : req
      )
    );
  };

  const handleReject = (id: string) => {
    setRequests(
      requests.map((req) =>
        req.id === id ? { ...req, status: 'rejected' } : req
      )
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <Check className="w-5 h-5" />;
      case 'rejected':
        return <X className="w-5 h-5" />;
      case 'pending':
        return <Clock className="w-5 h-5" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">Coach Verification Dashboard</h1>
      <div className="space-y-4">
        {requests.map((request) => (
          <div key={request.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">{request.coachName}</h2>
                <p className="text-gray-600">{request.email}</p>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStatusColor(request.status)}`}>
                {getStatusIcon(request.status)}
                <span className="capitalize font-semibold">{request.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Experience</p>
                <p className="font-semibold">{request.experience}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Certification</p>
                <p className="font-semibold">{request.certification}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Submitted Date</p>
                <p className="font-semibold">{request.submittedDate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Documents</p>
                <p className="font-semibold">{request.documents.length} files</p>
              </div>
            </div>

            {request.status === 'pending' && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleApprove(request.id)}
                  className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 font-semibold flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Approve
                </button>
                <button
                  onClick={() => handleReject(request.id)}
                  className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 font-semibold flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
