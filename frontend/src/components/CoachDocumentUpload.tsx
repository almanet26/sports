import { useState } from 'react';
import { Upload, FileCheck, AlertCircle } from 'lucide-react';

interface CoachDocument {
  id: string;
  fileName: string;
  fileType: string;
  uploadedDate: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface CoachRegistration {
  coachId: string;
  name: string;
  email: string;
  phone: string;
  experience: string;
  certification: string;
  documents: CoachDocument[];
  verificationStatus: 'pending' | 'approved' | 'rejected';
  canLogin: boolean;
}

export const CoachDocumentUpload = () => {
  const [coach, setCoach] = useState<CoachRegistration>({
    coachId: 'COACH001',
    name: 'John Smith',
    email: 'john@example.com',
    phone: '+1234567890',
    experience: '10 years',
    certification: 'ICC Level 2',
    documents: [
      {
        id: '1',
        fileName: 'certificate.pdf',
        fileType: 'PDF',
        uploadedDate: '2024-01-15',
        status: 'pending',
      },
      {
        id: '2',
        fileName: 'experience_letter.pdf',
        fileType: 'PDF',
        uploadedDate: '2024-01-15',
        status: 'pending',
      },
    ],
    verificationStatus: 'pending',
    canLogin: false,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadDocument = () => {
    if (!selectedFile) return;

    const newDocument: CoachDocument = {
      id: String(coach.documents.length + 1),
      fileName: selectedFile.name,
      fileType: selectedFile.type,
      uploadedDate: new Date().toISOString().split('T')[0],
      status: 'pending',
    };

    setCoach({
      ...coach,
      documents: [...coach.documents, newDocument],
    });
    setSelectedFile(null);
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

  const allDocumentsApproved = coach.documents.every((doc) => doc.status === 'approved');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Coach Registration & Document Verification</h1>
        <p className="text-gray-600 mb-8">Upload your documents for admin verification. You can login only after approval.</p>

        {/* Coach Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Coach Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="font-semibold">{coach.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-semibold">{coach.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-semibold">{coach.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Experience</p>
              <p className="font-semibold">{coach.experience}</p>
            </div>
          </div>
        </div>

        {/* Verification Status */}
        <div className={`rounded-lg shadow-md p-6 mb-6 ${allDocumentsApproved ? 'bg-green-50' : 'bg-yellow-50'}`}>
          <div className="flex items-center gap-3">
            {allDocumentsApproved ? (
              <>
                <FileCheck className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-bold text-green-800">All Documents Approved</p>
                  <p className="text-green-700">You can now login to your account</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-6 h-6 text-yellow-600" />
                <div>
                  <p className="font-bold text-yellow-800">Pending Verification</p>
                  <p className="text-yellow-700">Please upload all required documents for admin review</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Document Upload */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Upload Documents</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-4">
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 text-gray-400 mb-2" />
              <input
                type="file"
                onChange={handleFileSelect}
                className="mb-2"
              />
              {selectedFile && (
                <p className="text-sm text-gray-600 mb-2">Selected: {selectedFile.name}</p>
              )}
              <button
                onClick={handleUploadDocument}
                disabled={!selectedFile}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
              >
                Upload Document
              </button>
            </div>
          </div>
        </div>

        {/* Documents List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Uploaded Documents</h2>
          <div className="space-y-3">
            {coach.documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-semibold">{doc.fileName}</p>
                  <p className="text-sm text-gray-600">Uploaded: {doc.uploadedDate}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(doc.status)}`}>
                  {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Login Button */}
        <div className="mt-8">
          <button
            disabled={!allDocumentsApproved}
            className={`w-full py-3 rounded-lg font-bold text-lg transition ${
              allDocumentsApproved
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-400 text-gray-600 cursor-not-allowed'
            }`}
          >
            {allDocumentsApproved ? 'Login to Dashboard' : 'Waiting for Admin Approval'}
          </button>
        </div>
      </div>
    </div>
  );
};
