import React from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { CustomerInfo } from '../types';

interface CustomerInfoFormProps {
  onSubmit: (info: CustomerInfo) => void;
  onClose: () => void;
  initialData?: CustomerInfo;
}

const CustomerInfoForm: React.FC<CustomerInfoFormProps> = ({ onSubmit, onClose, initialData }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerInfo>({
    defaultValues: initialData,
  });

  const handleFormSubmit = (data: CustomerInfo) => {
    onSubmit(data);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Customer Information</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              {...register('name', { required: 'Name is required' })}
              className="input"
              placeholder="Enter your full name"
            />
            {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              })}
              className="input"
              placeholder="Enter your email address"
            />
            {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
              Company (Optional)
            </label>
            <input
              type="text"
              id="company"
              {...register('company')}
              className="input"
              placeholder="Enter your company name"
            />
          </div>

          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
              User/Account ID (Optional)
            </label>
            <input
              type="text"
              id="userId"
              {...register('userId')}
              className="input"
              placeholder="Enter your user or account ID"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-md">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-md">
              Save Information
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerInfoForm;
