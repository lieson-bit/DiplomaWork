import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Upload, FileText, Camera, Car, User, MapPin, Phone, Mail, CheckCircle, AlertCircle, X, Loader2, Calendar } from 'lucide-react';
import { driverApi, getAuthToken } from '../src/lib/api';
import { toast } from 'sonner';
import { getCurrentUser }  from '../src/lib/api';
import { DebugPanel } from './DebugPanel';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-800 font-semibold">Something went wrong</h3>
          <p className="text-red-600 text-sm mt-1">{this.state.error}</p>
          <button 
            className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded text-sm"
            onClick={() => this.setState({ hasError: false, error: '' })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface DriverOnboardingProps {
  onComplete: () => void;
}

interface DocumentStatus {
  uploaded: boolean; 
  uploading: boolean; 
  success?: boolean;
  error?: string;
  id?: string;
  file: File | null;
}

interface DriverProfile {
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  licensePlate: string;
  vehicleColor: string;
  maxWeight: string;
  maxVolume: string;
  licenseNumber: string;
  licenseExpiry: string;
  insuranceNumber: string;
  insuranceExpiry: string;
  vehicleImages: File[];
  categories: string[];
  serviceAreas: string[];
  availability: {
    [key: string]: AvailabilityDay;
  };
}

interface AvailabilityDay {
  start: string;
  end: string;
  available: boolean;
}

export function DriverOnboarding({ onComplete }: DriverOnboardingProps) {
  console.log('🔵 DriverOnboarding component mounted');
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  const [documentStatus, setDocumentStatus] = useState({
    driverLicense: { 
      uploaded: false, 
      uploading: false, 
      success: undefined as boolean | undefined,
      error: undefined as string | undefined,
      id: undefined as string | undefined,
      file: null as File | null
    },
    proofOfInsurance: { 
      uploaded: false, 
      uploading: false, 
      success: undefined as boolean | undefined,
      error: undefined as string | undefined,
      id: undefined as string | undefined,
      file: null as File | null
    },
    vehicleRegistration: { 
      uploaded: false, 
      uploading: false, 
      success: undefined as boolean | undefined,
      error: undefined as string | undefined,
      id: undefined as string | undefined,
      file: null as File | null
    }
  });
  
  const [backgroundCheck, setBackgroundCheck] = useState(false);
  
  const driverLicenseRef = useRef<HTMLInputElement>(null);
  const insuranceRef = useRef<HTMLInputElement>(null);
  const registrationRef = useRef<HTMLInputElement>(null);
  const vehiclePhotosRef = useRef<HTMLInputElement>(null);
  
  const initialProfile: DriverProfile = {
    dateOfBirth: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    vehicleType: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    licensePlate: '',
    vehicleColor: '',
    maxWeight: '',
    maxVolume: '',
    licenseNumber: '',
    licenseExpiry: '',
    insuranceNumber: '',
    insuranceExpiry: '',
    vehicleImages: [],
    categories: [],
    serviceAreas: [],
    availability: {
      monday: { start: '09:00', end: '17:00', available: true },
      tuesday: { start: '09:00', end: '17:00', available: true },
      wednesday: { start: '09:00', end: '17:00', available: true },
      thursday: { start: '09:00', end: '17:00', available: true },
      friday: { start: '09:00', end: '17:00', available: true },
      saturday: { start: '10:00', end: '16:00', available: false },
      sunday: { start: '10:00', end: '16:00', available: false }
    }
  };

  const [profile, setProfile] = useState(initialProfile);

  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;

  const vehicleTypes = [
  { value: 'motorbike', label: 'Motorbike' },
  { value: 'small_van', label: 'Small Van' },
  { value: 'medium_truck', label: 'Medium Truck' },
  { value: 'large_truck', label: 'Large Truck' },
];

  const serviceCategories = [
    'Documents & Small Packages',
    'Food & Beverages',
    'Electronics',
    'Clothing & Textiles',
    'Furniture & Appliances',
    'Construction Materials',
    'Medical Supplies',
    'Fragile Items',
    'Refrigerated Goods',
    'Hazardous Materials'
  ];

  const states = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
    'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
    'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
    'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
    'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
    'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
    'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
  ];

  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('🔄 DriverOnboarding mounted - loading user data');
    setError(null);
    
    const currentUser = getCurrentUser();
    if (currentUser) {
      console.log('👤 User data loaded:', currentUser);
      setUserData(currentUser);
    } else {
      console.error('❌ No user found in localStorage');
      toast.error('Please login to continue');
    }
  }, []);

  useEffect(() => {
    console.log('🔄 Current Step:', currentStep);
    console.log('📄 Document Status:', documentStatus);
    console.log('✅ Background Check:', backgroundCheck);
    console.log('🔐 Auth Token exists:', !!getAuthToken());
    console.log('👤 User Data:', userData);
  }, [currentStep, documentStatus, backgroundCheck, userData]);

  const validateFile = (file: File): string | null => {
    console.log('📏 Validating file:', file.name, file.size, file.type);
    
    const maxSizeMB = 5;
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size must be less than ${maxSizeMB}MB`;
    }
    
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'application/pdf', 
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return 'File type not supported. Please upload JPG, PNG, PDF, or DOC files.';
    }
    
    return null;
  };

  const handleFileUpload = async (field: 'driverLicense' | 'proofOfInsurance' | 'vehicleRegistration', file: File | null): Promise<void> => {
    console.log('🔄 handleFileUpload called:', field, file?.name || 'null');
    
    if (!file) {
      console.log('⚠️ No file provided for', field);
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    console.log(`✅ Starting upload for ${field}:`, file.name);

    try {
      setDocumentStatus(prev => ({ 
        ...prev, 
        [field]: { 
          ...prev[field],
          uploading: true,
          error: undefined
        } 
      }));

      const documentTypeMap = {
        driverLicense: 'license',
        proofOfInsurance: 'insurance',
        vehicleRegistration: 'registration'
      };

      const formData = new FormData();
      formData.append('document', file);
      formData.append('type', documentTypeMap[field]);
      formData.append('name', getDocumentName(field));

      const response = await driverApi.uploadDocument(formData);

      if (response.success) {
        toast.success(`${getDocumentName(field)} uploaded successfully!`);
        setDocumentStatus(prev => ({ 
          ...prev, 
          [field]: { 
            uploaded: true, 
            uploading: false, 
            success: true,
            error: undefined,
            id: response.data?.id,
            file: file 
          } 
        }));
      } else {
        // SAFELY extract error message
        const errorMessage = response.error 
          ? (typeof response.error === 'string' ? response.error : response.error.message || 'Upload failed')
          : 'Upload failed';
        
        toast.error(`Failed to upload ${getDocumentName(field)}: ${errorMessage}`);
        setDocumentStatus(prev => ({ 
          ...prev, 
          [field]: { 
            uploaded: true,
            uploading: false, 
            success: false,
            error: errorMessage, // Store string, not object
            id: undefined,
            file: file 
          } 
        }));
      }
    } catch (error: any) {
      console.error('🚨 Error uploading document:', error);
      const errorMessage = error?.message || 'Network error';
      toast.error(`Error uploading document: ${errorMessage}`);
      setDocumentStatus(prev => ({ 
        ...prev, 
        [field]: { 
          uploaded: true,
          uploading: false, 
          success: false,
          error: errorMessage, // Store string, not object
          id: undefined,
          file: file 
        } 
      }));
    }
  };

  const getDocumentName = (field: 'driverLicense' | 'proofOfInsurance' | 'vehicleRegistration'): string => {
    switch (field) {
      case 'driverLicense': return 'Driving License';
      case 'proofOfInsurance': return 'Proof of Insurance';
      case 'vehicleRegistration': return 'Vehicle Registration';
      default: return 'Document';
    }
  };

  const removeFile = (field: 'driverLicense' | 'proofOfInsurance' | 'vehicleRegistration'): void => {
    console.log('🗑️ Removing file for', field);
    setDocumentStatus(prev => ({ 
      ...prev, 
      [field]: { 
        uploaded: false, 
        uploading: false, 
        success: undefined,
        error: undefined,
        id: undefined,
        file: null 
      } 
    }));
    toast.info(`${getDocumentName(field)} removed`);
  };

  const handleCategoryToggle = (category: string): void => {
    setProfile(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const handleAvailabilityChange = (
    day: string, 
    field: 'start' | 'end' | 'available', 
    value: string | boolean
  ): void => {
    setProfile(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          [field]: value
        }
      }
    }));
  };

  const createDriverProfile = async (): Promise<boolean> => {
    console.log('👤 Creating driver profile...');
    
    if (!userData) {
      toast.error('No user found. Please login again.');
      return false;
    }

    try {
      // Check if profile already exists
      const existingProfile = await driverApi.getProfile();
      if (existingProfile.success) {
        console.log('✅ Driver profile already exists:', existingProfile.data);
        return true;
      }
    } catch (error) {
      console.log('No existing profile found, will create new one');
    }

    try {
      const formatDate = (date: Date | string): string => {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        return d.toISOString().split('T')[0]; // "2026-12-31"
      };
      const profileData = {
        licenseNumber: profile.licenseNumber,
        licenseExpiry: formatDate(profile.licenseExpiry),
        insuranceNumber: profile.insuranceNumber,
        insuranceExpiry: formatDate(profile.insuranceExpiry),
      };

      console.log('📤 Sending profile data to driver service:', profileData);

      const response = await driverApi.createProfile(profileData);

      console.log('📨 Profile creation response:', response);

      if (response.success) {
        console.log('✅ Driver profile created successfully');
        toast.success('Driver profile created successfully');
        return true;
      }

      // 🔴 FIXED: Safely handle error message (it might be an object)
      let errorMessage = response.error || 'Unknown error';

      // Convert error to string if it's an object
      if (typeof errorMessage === 'object') {
        errorMessage = errorMessage.message || JSON.stringify(errorMessage);
      }

      console.log('Profile creation failed:', errorMessage);

      // 🔴 FIXED: Only call .includes() if errorMessage is a string
      const errorString = String(errorMessage).toLowerCase();

      // If profile already exists in some form, try to update it
      if (errorString.includes('already') || errorString.includes('exists') || response.status === 409) {
        console.log('Profile seems to exist in some form, trying to update...');

        const updateResponse = await driverApi.updateProfile(profileData);
        if (updateResponse.success) {
          toast.success('Driver profile updated');
          return true;
        }

        // If update also failed, show the update error
        let updateError = updateResponse.error || 'Update failed';
        if (typeof updateError === 'object') {
          updateError = updateError.message || JSON.stringify(updateError);
        }
        toast.error(`Could not update profile: ${updateError}`);
        return false;
      }

      toast.error(`Could not create profile: ${errorString}`);
      return false;

    } catch (error: any) {
      console.error('❌ Error in createDriverProfile:', error);

      // 🔴 FIXED: Safely extract error message
      let errorMsg = error?.message || 'Network error';
      if (typeof errorMsg === 'object') {
        errorMsg = errorMsg.message || JSON.stringify(errorMsg);
      }

      toast.error(`Error creating profile: ${errorMsg}`);
      return false;
    }
  };

  const addVehicle = async (): Promise<string | null> => {
    console.log('🚗 Adding vehicle...');
    try {
      const vehicleData = {
        type: profile.vehicleType,
        make: profile.vehicleMake,
        model: profile.vehicleModel,
        year: parseInt(profile.vehicleYear) || 2023,
        color: profile.vehicleColor,
        licensePlate: profile.licensePlate,
        maxWeight: parseFloat(profile.maxWeight) || 1000,
        maxVolume: parseFloat(profile.maxVolume) || 10,
        insuranceInfo: profile.insuranceNumber || 'To be uploaded'
      };
    
      console.log('📤 Vehicle data:', vehicleData);
      
      if (!vehicleData.type || !vehicleData.licensePlate) {
        toast.error('Please provide vehicle type and license plate');
        return null;
      }
      
      const response = await driverApi.addVehicle(vehicleData);
      
      console.log('📨 Vehicle add response:', response);
      
      if (response.success) {
        const responseData = response.data || {};
        const vehicleId = responseData.id || 
                         responseData.vehicleId || 
                         (responseData.vehicle && responseData.vehicle.id);
        
        if (vehicleId) {
          toast.success('Vehicle added successfully');
          return vehicleId;
        } else {
          console.log('Vehicle added but no ID returned:', responseData);
          toast.success('Vehicle information saved');
          return 'vehicle-saved';
        }
      }
      
      console.log('Vehicle add failed:', response.error);
      toast.error(`Failed to add vehicle: ${response.error}`);
      return null;
      
    } catch (error: any) {
      console.error('Error adding vehicle:', error);
      const errorMsg = response.error 
        ? (typeof response.error === 'string' ? response.error : response.error?.message || 'Add failed')
        : 'Add vehicle failed';
      return null;
    }
  };

  const uploadVehicleImages = async (vehicleId: string, files: File[]): Promise<boolean> => {
    console.log('📸 Uploading vehicle images...');
    try {
      if (files.length === 0) return true;
      
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await driverApi.uploadVehicleImage(vehicleId, formData);
        return response.success;
      });
    
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(result => result).length;
      
      if (successfulUploads > 0) {
        toast.success(`${successfulUploads} vehicle image(s) uploaded`);
      }
      
      return successfulUploads > 0;
    } catch (error: any) {
      console.error('Error uploading vehicle images:', error);
      return false;
    }
  };

  const setAvailability = async (): Promise<boolean> => {
    console.log('⏰ Setting availability...');
    try {
      const availabilityData = Object.entries(profile.availability)
        .filter(([day, data]) => {
          return (data as AvailabilityDay).available;
        })
        .map(([day, data]) => {
          const availabilityData = data as AvailabilityDay;
          return {
            dayOfWeek: dayToNumber(day),
            startTime: availabilityData.start,
            endTime: availabilityData.end
          };
        });

    const response = await driverApi.setAvailability(availabilityData);
    
      if (response.success) {
        toast.success('Availability preferences saved');
        return true;
      }

      const errorMsg = response.error 
        ? (typeof response.error === 'string' ? response.error : response.error?.message || 'Save failed')
        : 'Failed to save availability';
      throw new Error(errorMsg);

    } catch (error: any) {
      console.error('Error setting availability:', error);
      toast.error(`Error saving availability: ${error.message}`);
      return false;
    }
  };
  const dayToNumber = (day: string): number => {
    const days: string[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days.indexOf(day.toLowerCase());
  };

  const nextStep = async (): Promise<void> => {
    console.log('➡️ Next step clicked. Current step:', currentStep);
    
    if (currentStep < totalSteps) {
      if (currentStep === 1) {
        console.log('📋 Moving from Step 1 to Step 2 - Creating driver profile...');

        // 🔴 CRITICAL: Create driver profile BEFORE allowing document uploads
        toast.info('Creating your driver profile...', { duration: 3000 });
        const profileCreated = await createDriverProfile();

        if (!profileCreated) {
          toast.error('Failed to create driver profile. Please check your information.');
          return; // Don't proceed to next step
        }

        console.log('✅ Driver profile created, proceeding to Step 2');
      }

      if (currentStep === 2) {
        console.log('📄 Checking Step 2 validation...');

        const hasAllFilesSelected = 
          documentStatus.driverLicense.file &&
          documentStatus.proofOfInsurance.file &&
          documentStatus.vehicleRegistration.file &&
          backgroundCheck;

        console.log('Has all files selected and background check?', hasAllFilesSelected);

        if (!hasAllFilesSelected) {
          toast.error('Please select all required files and consent to background check');
          return;
        }
      }

      console.log('✅ Moving to step:', currentStep + 1);
      setCurrentStep(currentStep + 1);
    } else {
      await handleCompleteRegistration();
    }
  };

  const prevStep = (): void => {
    console.log('⬅️ Previous step clicked');
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCompleteRegistration = async (): Promise<void> => {
    console.log('🏁 Completing registration...');
    setIsSubmitting(true);
    
    try {
      toast.info('Starting registration process...', { duration: Infinity });

      // 🔴 STEP 1: CREATE DRIVER PROFILE FIRST (MUST BE FIRST!)
      console.log('Step 1: Creating driver profile...');
      const profileCreated = await createDriverProfile();
      if (!profileCreated) {
        toast.dismiss();
        toast.error('Failed to create driver profile');
        return;
      }
      toast.success('Driver profile created');

      // 🔴 STEP 2: NOW upload documents (only after profile exists)
      console.log('Step 2: Uploading documents...');

      // Track successful uploads
      const uploadResults = [];

      // Upload driver license if file exists
      if (documentStatus.driverLicense.file) {
        console.log('Uploading driver license...');
        toast.info('Uploading driver license...');
        try {
          await handleFileUpload('driverLicense', documentStatus.driverLicense.file);
          uploadResults.push(documentStatus.driverLicense.success === true);
        } catch (error) {
          console.error('Driver license upload failed:', error);
          uploadResults.push(false);
        }
      }

      // Upload insurance if file exists
      if (documentStatus.proofOfInsurance.file) {
        console.log('Uploading proof of insurance...');
        toast.info('Uploading proof of insurance...');
        try {
          await handleFileUpload('proofOfInsurance', documentStatus.proofOfInsurance.file);
          uploadResults.push(documentStatus.proofOfInsurance.success === true);
        } catch (error) {
          console.error('Insurance upload failed:', error);
          uploadResults.push(false);
        }
      }

      // Upload registration if file exists
      if (documentStatus.vehicleRegistration.file) {
        console.log('Uploading vehicle registration...');
        toast.info('Uploading vehicle registration...');
        try {
          await handleFileUpload('vehicleRegistration', documentStatus.vehicleRegistration.file);
          uploadResults.push(documentStatus.vehicleRegistration.success === true);
        } catch (error) {
          console.error('Registration upload failed:', error);
          uploadResults.push(false);
        }
      }

      const successfulUploads = uploadResults.filter(Boolean).length;
      console.log(`Document upload results: ${successfulUploads}/3 successful`);

      // 🔴 STEP 3: Add vehicle (requires profile to exist)
      console.log('Step 3: Adding vehicle...');
      const vehicleId = await addVehicle();
      if (!vehicleId) {
        toast.dismiss();
        toast.error('Failed to add vehicle');
        return;
      }

      // 🔴 STEP 4: Upload vehicle images (optional)
      if (profile.vehicleImages.length > 0) {
        console.log('Step 4: Uploading vehicle images...');
        await uploadVehicleImages(vehicleId, profile.vehicleImages);
      }

      // 🔴 STEP 5: Set availability
      console.log('Step 5: Setting availability...');
      await setAvailability();

      toast.dismiss();

      if (successfulUploads === 3) {
        toast.success('🎉 Driver onboarding completed successfully! All documents uploaded.');
      } else if (successfulUploads > 0) {
        toast.success(`✅ Registration complete! ${successfulUploads}/3 documents uploaded successfully.`);
      } else {
        toast.success(`✅ Registration complete! You can upload documents later in your profile.`);
      }

      localStorage.setItem('driverOnboardingCompleted', 'true');

      setTimeout(() => {
        console.log('✅ Onboarding complete, calling onComplete');
        onComplete();
      }, 2000);

    } catch (error: any) {
      toast.dismiss();
      console.error('Registration failed:', error);
      const errorMsg = error?.message || 'Registration failed';
      toast.error(`Registration failed: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  const isStepValid = (): boolean => {
    console.log(`🔍 Checking if step ${currentStep} is valid...`);
    
    switch (currentStep) {
      case 1:
        const step1Valid = (
          !!profile.dateOfBirth &&
          !!profile.address &&
          !!profile.city &&
          !!profile.state &&
          !!profile.zipCode &&
          !!profile.licenseNumber &&
          !!profile.licenseExpiry &&
          !!profile.insuranceNumber &&
          !!profile.insuranceExpiry
        );
        console.log('Step 1 valid?', step1Valid);
        return step1Valid;
        
      case 2:
        const step2Valid = (
          !!documentStatus.driverLicense.file &&
          !!documentStatus.proofOfInsurance.file &&
          !!documentStatus.vehicleRegistration.file &&
          backgroundCheck
        );
        console.log('Step 2 valid?', step2Valid);
        return step2Valid;
        
      case 3:
        const step3Valid = (
          !!profile.vehicleType &&
          !!profile.vehicleMake &&
          !!profile.vehicleModel &&
          !!profile.vehicleYear &&
          !!profile.licensePlate &&
          !!profile.vehicleColor &&
          !!profile.maxWeight &&
          !!profile.maxVolume
        );
        console.log('Step 3 valid?', step3Valid);
        return step3Valid;
        
      case 4:
        console.log('Step 4 always valid (optional)');
        return true;
        
      case 5:
        console.log('Step 5 always valid (review)');
        return true;
        
      default:
        console.log('Default case, not valid');
        return false;
    }
  };

  const triggerFileInput = (ref: React.RefObject<HTMLInputElement>) => {
    console.log('🖱️ Triggering file input click');
    if (ref.current) {
      ref.current.click();
    }
  };

  const renderStep = () => {
    console.log('🎨 Rendering step:', currentStep);
    
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <User className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl mb-2">Driver Information</h3>
              <p className="text-gray-600">Complete your driver profile details</p>
              {userData && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    Welcome, <strong>{userData.firstName} {userData.lastName}</strong> ({userData.email})
                  </p>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={profile.dateOfBirth}
                    onChange={(e) => setProfile({...profile, dateOfBirth: e.target.value})}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  value={profile.address}
                  onChange={(e) => setProfile({...profile, address: e.target.value})}
                  placeholder="123 Main Street"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={profile.city}
                    onChange={(e) => setProfile({...profile, city: e.target.value})}
                    placeholder="New York"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Select 
                    value={profile.state} 
                    onValueChange={(value: string) => setProfile({...profile, state: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code *</Label>
                <Input
                  id="zipCode"
                  value={profile.zipCode}
                  onChange={(e) => setProfile({...profile, zipCode: e.target.value})}
                  placeholder="10001"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="licenseNumber">Driver License Number *</Label>
                <Input
                  id="licenseNumber"
                  value={profile.licenseNumber}
                  onChange={(e) => setProfile({...profile, licenseNumber: e.target.value})}
                  placeholder="DL12345678"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="licenseExpiry">License Expiry Date *</Label>
                <Input
                  id="licenseExpiry"
                  type="date"
                  value={profile.licenseExpiry}
                  onChange={(e) => setProfile({...profile, licenseExpiry: e.target.value})}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="insuranceNumber">Insurance Policy Number *</Label>
                <Input
                  id="insuranceNumber"
                  value={profile.insuranceNumber}
                  onChange={(e) => setProfile({...profile, insuranceNumber: e.target.value})}
                  placeholder="INS12345678"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="insuranceExpiry">Insurance Expiry Date *</Label>
                <Input
                  id="insuranceExpiry"
                  type="date"
                  value={profile.insuranceExpiry}
                  onChange={(e) => setProfile({...profile, insuranceExpiry: e.target.value})}
                  required
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <ErrorBoundary>
          <div className="space-y-6">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl mb-2">Required Documents</h3>
              <p className="text-gray-600">Select your documents for upload (Max 5MB each)</p>
              <div className="mt-2 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
               <strong>Note:</strong> Documents will be uploaded after creating your profile in the final step.
              </p>
          </div>
            </div>
            
            <div className="space-y-6">
              {/* Driver License */}
              <div className="space-y-2">
                <Label>Driver's License *</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-2">Upload front and back of your driver's license (JPG, PNG, PDF)</p>
                  <input
                    ref={driverLicenseRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={async (e) => {
                      console.log('Driver license file selected:', e.target.files?.[0]?.name);
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload('driverLicense', file);
                      }
                      e.target.value = '';
                    }}
                    className="hidden"
                    id="driver-license"
                  />
                  <Button 
                    variant="outline" 
                    className="cursor-pointer"
                    onClick={() => triggerFileInput(driverLicenseRef)}
                  >
                    Choose File
                  </Button>
                  
                  {documentStatus.driverLicense.file && (
                    <div className="mt-3 flex flex-col items-center space-y-2">
                      <div className="flex items-center justify-center space-x-2">
                        {documentStatus.driverLicense.uploading ? (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Uploading...
                          </Badge>
                        ) : documentStatus.driverLicense.success === true ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Uploaded Successfully
                          </Badge>
                        ) : documentStatus.driverLicense.success === false ? (
                          <Badge className="bg-red-100 text-red-800">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Upload Failed
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800">
                            <Upload className="mr-1 h-3 w-3" />
                            Selected
                          </Badge>
                        )}
                        <span className="text-sm font-medium">
                          {documentStatus.driverLicense.file.name} ({(documentStatus.driverLicense.file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile('driverLicense')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {documentStatus.driverLicense.success === false && (
                        <div className="text-sm text-red-600">
                          {documentStatus.driverLicense.error || 'Upload failed'}
                        </div>
                      )}
                      {!documentStatus.driverLicense.uploading && documentStatus.driverLicense.success !== true && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (documentStatus.driverLicense.file) {
                              handleFileUpload('driverLicense', documentStatus.driverLicense.file);
                            }
                          }}
                        >
                          <Upload className="mr-2 h-3 w-3" />
                          {documentStatus.driverLicense.success === false ? 'Retry Upload' : 'Upload Now'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Proof of Insurance */}
              <div className="space-y-2">
                <Label>Proof of Insurance *</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-2">Current auto insurance policy (JPG, PNG, PDF)</p>
                  <input
                    ref={insuranceRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={async (e) => {
                      console.log('Insurance file selected:', e.target.files?.[0]?.name);
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload('proofOfInsurance', file);
                      }
                      e.target.value = '';
                    }}
                    className="hidden"
                    id="insurance"
                  />
                  <Button 
                    variant="outline" 
                    className="cursor-pointer"
                    onClick={() => triggerFileInput(insuranceRef)}
                  >
                    Choose File
                  </Button>
                  
                  {documentStatus.proofOfInsurance.file && (
                    <div className="mt-3 flex flex-col items-center space-y-2">
                      <div className="flex items-center justify-center space-x-2">
                        {documentStatus.proofOfInsurance.uploading ? (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Uploading...
                          </Badge>
                        ) : documentStatus.proofOfInsurance.success === true ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Uploaded Successfully
                          </Badge>
                        ) : documentStatus.proofOfInsurance.success === false ? (
                          <Badge className="bg-red-100 text-red-800">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Upload Failed
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800">
                            <Upload className="mr-1 h-3 w-3" />
                            Selected
                          </Badge>
                        )}
                        <span className="text-sm font-medium">
                          {documentStatus.proofOfInsurance.file.name} ({(documentStatus.proofOfInsurance.file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile('proofOfInsurance')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {documentStatus.proofOfInsurance.success === false && (
                        <div className="text-sm text-red-600">
                          {documentStatus.proofOfInsurance.error || 'Upload failed'}
                        </div>
                      )}
                      {!documentStatus.proofOfInsurance.uploading && documentStatus.proofOfInsurance.success !== true && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (documentStatus.proofOfInsurance.file) {
                              handleFileUpload('proofOfInsurance', documentStatus.proofOfInsurance.file);
                            }
                          }}
                        >
                          <Upload className="mr-2 h-3 w-3" />
                          {documentStatus.proofOfInsurance.success === false ? 'Retry Upload' : 'Upload Now'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Vehicle Registration */}
              <div className="space-y-2">
                <Label>Vehicle Registration *</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-2">Vehicle registration document (JPG, PNG, PDF)</p>
                  <input
                    ref={registrationRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={async (e) => {
                      console.log('Registration file selected:', e.target.files?.[0]?.name);
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload('vehicleRegistration', file);
                      }
                      e.target.value = '';
                    }}
                    className="hidden"
                    id="registration"
                  />
                  <Button 
                    variant="outline" 
                    className="cursor-pointer"
                    onClick={() => triggerFileInput(registrationRef)}
                  >
                    Choose File
                  </Button>
               
                  {documentStatus.vehicleRegistration.file && (
                    <div className="mt-3 flex flex-col items-center space-y-2">
                      <div className="flex items-center justify-center space-x-2">
                        {documentStatus.vehicleRegistration.uploading ? (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Uploading...
                          </Badge>
                        ) : documentStatus.vehicleRegistration.success === true ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Uploaded
                          </Badge>
                        ) : documentStatus.vehicleRegistration.success === false ? (
                          <Badge className="bg-red-100 text-red-800">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Upload Failed
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800">
                            <Upload className="mr-1 h-3 w-3" />
                            Selected
                          </Badge>
                        )}
                        <span className="text-sm font-medium">
                          {documentStatus.vehicleRegistration.file.name} ({(documentStatus.vehicleRegistration.file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile('vehicleRegistration')}
                          disabled={documentStatus.vehicleRegistration.uploading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {documentStatus.vehicleRegistration.success === false && (
                        <div className="text-sm text-red-600">
                          {documentStatus.vehicleRegistration.error || 'Upload failed'}
                        </div>
                      )}
                      {!documentStatus.vehicleRegistration.uploading && !documentStatus.vehicleRegistration.success && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (documentStatus.vehicleRegistration.file) {
                              handleFileUpload('vehicleRegistration', documentStatus.vehicleRegistration.file);
                            }
                          }}
                        >
                          <Upload className="mr-2 h-3 w-3" />
                          Upload Now
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Background Check Consent */}
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="background-check"
                    checked={backgroundCheck}
                    onCheckedChange={(checked: boolean) => setBackgroundCheck(checked)}
                    required
                  />
                  <div>
                    <Label htmlFor="background-check" className="cursor-pointer">
                      Background Check Consent *
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      I consent to a background check as required for driver verification. 
                      This helps ensure safety for all platform users.
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Status Summary */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Document Status</h4>
                <div className="space-y-2 text-sm">
                  {(['driverLicense', 'proofOfInsurance', 'vehicleRegistration'] as const).map((field) => {
                    const status = documentStatus[field];
                    const name = getDocumentName(field);
                    
                    let statusText = 'Not Selected';
                    let statusColor = 'text-gray-700';
                    let icon = <AlertCircle className="h-4 w-4 mr-2 text-gray-500" />;
                    
                    if (status.uploading) {
                      statusText = 'Uploading...';
                      statusColor = 'text-yellow-700';
                      icon = <Loader2 className="h-4 w-4 mr-2 text-yellow-500 animate-spin" />;
                    } else if (status.success === true) {
                      statusText = 'Uploaded Successfully';
                      statusColor = 'text-green-700';
                      icon = <CheckCircle className="h-4 w-4 mr-2 text-green-500" />;
                    } else if (status.success === false) {
                      statusText = 'Upload Failed';
                      statusColor = 'text-red-700';
                      icon = <AlertCircle className="h-4 w-4 mr-2 text-red-500" />;
                    } else if (status.file) {
                      statusText = 'Selected (Ready to Upload)';
                      statusColor = 'text-blue-700';
                      icon = <CheckCircle className="h-4 w-4 mr-2 text-blue-500" />;
                    }
                    
                    return (
                      <div key={field} className={`flex items-center ${statusColor}`}>
                        {icon}
                        <span>{name}: {statusText}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div></ErrorBoundary>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Car className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl mb-2">Vehicle Information</h3>
              <p className="text-gray-600">Tell us about your vehicle</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Vehicle Type *</Label>
                <Select value={profile.vehicleType} onValueChange={(value: string) => setProfile({...profile, vehicleType: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="make">Make *</Label>
                  <Input
                    id="make"
                    value={profile.vehicleMake}
                    onChange={(e) => setProfile({...profile, vehicleMake: e.target.value})}
                    placeholder="Ford"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <Input
                    id="model"
                    value={profile.vehicleModel}
                    onChange={(e) => setProfile({...profile, vehicleModel: e.target.value})}
                    placeholder="Transit"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="year">Year *</Label>
                  <Input
                    id="year"
                    value={profile.vehicleYear}
                    onChange={(e) => setProfile({...profile, vehicleYear: e.target.value})}
                    placeholder="2020"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color *</Label>
                  <Input
                    id="color"
                    value={profile.vehicleColor}
                    onChange={(e) => setProfile({...profile, vehicleColor: e.target.value})}
                    placeholder="White"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="licensePlate">License Plate *</Label>
                <Input
                  id="licensePlate"
                  value={profile.licensePlate}
                  onChange={(e) => setProfile({...profile, licensePlate: e.target.value})}
                  placeholder="ABC-123"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxWeight">Max Weight (kg) *</Label>
                  <Input
                    id="maxWeight"
                    type="number"
                    value={profile.maxWeight}
                    onChange={(e) => setProfile({...profile, maxWeight: e.target.value})}
                    placeholder="1000"
                    min="0"
                    step="0.1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxVolume">Max Volume (m³) *</Label>
                  <Input
                    id="maxVolume"
                    type="number"
                    value={profile.maxVolume}
                    onChange={(e) => setProfile({...profile, maxVolume: e.target.value})}
                    placeholder="10"
                    min="0"
                    step="0.1"
                    required
                  />
                </div>
              </div>

              {/* Vehicle Photos */}
              <div className="space-y-2">
                <Label>Vehicle Photos (Optional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Camera className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-2">Upload photos of your vehicle (exterior and interior)</p>
                  <input
                    ref={vehiclePhotosRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      const selectedFiles = files.slice(0, 5);
                      setProfile({ ...profile, vehicleImages: selectedFiles as File[] });
                      // Reset input value to allow re-selecting same file
                      if (e.target) e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      vehiclePhotosRef.current?.click(); // Programmatically trigger
                    }}
                  >
                    Choose Photos (Max 5)
                  </Button>
                  {profile.vehicleImages.length > 0 && (
                    <div className="mt-3">
                      <Badge className="bg-green-100 text-green-800 mb-2">
                        ✓ {profile.vehicleImages.length} photo(s) selected
                      </Badge>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {profile.vehicleImages.map((file: File, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded">
                            <span className="text-xs truncate">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newImages = [...profile.vehicleImages];
                                newImages.splice(index, 1);
                                setProfile({...profile, vehicleImages: newImages});
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <MapPin className="mx-auto h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl mb-2">Service Preferences</h3>
              <p className="text-gray-600">What types of deliveries do you want to handle?</p>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Service Categories (Optional)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {serviceCategories.map((category) => (
                    <div
                      key={category}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        profile.categories.includes(category)
                          ? 'bg-blue-50 border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleCategoryToggle(category)}
                    >
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={profile.categories.includes(category)}
                          readOnly
                        />
                        <span className="text-sm">{category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Service Areas (Optional)</Label>
                <Textarea
                  placeholder="Enter the areas you're willing to serve (e.g., Downtown, Uptown, specific neighborhoods)"
                  value={profile.serviceAreas.join(', ')}
                  onChange={(e) => setProfile({...profile, serviceAreas: e.target.value.split(', ').filter(Boolean)})}
                  rows={3}
                />
              </div>

              <div className="space-y-3">
                <Label>Weekly Availability *</Label>
                <div className="space-y-3">
                  {Object.entries(profile.availability).map(([day, data]) => {
                    const availabilityData = data as AvailabilityDay;
                    return (
                      <div key={day} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={availabilityData.available}
                            onCheckedChange={(checked: boolean) => 
                              handleAvailabilityChange(day, 'available', checked)
                            }
                          />
                          <span className="capitalize">{day}</span>
                        </div>
                        {availabilityData.available && (
                          <div className="flex items-center space-x-2">
                            <Input
                              type="time"
                              value={availabilityData.start}
                              onChange={(e) => handleAvailabilityChange(day, 'start', e.target.value)}
                              className="w-24"
                            />
                            <span>to</span>
                            <Input
                              type="time"
                              value={availabilityData.end}
                              onChange={(e) => handleAvailabilityChange(day, 'end', e.target.value)}
                              className="w-24"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        const successfulUploads = [
          documentStatus.driverLicense.success === true,
          documentStatus.proofOfInsurance.success === true,
          documentStatus.vehicleRegistration.success === true
        ].filter(Boolean).length;

        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-600 mb-4" />
              <h3 className="text-xl mb-2">Review & Complete</h3>
              <p className="text-gray-600">Review your information before submitting</p>
            </div>
            
            <div className="space-y-4">
              {userData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Account Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div><span className="text-gray-600">Name:</span> {userData.firstName} {userData.lastName}</div>
                      <div><span className="text-gray-600">Email:</span> {userData.email}</div>
                      <div><span className="text-gray-600">Phone:</span> {userData.phone || 'Not provided'}</div>
                      <div><span className="text-gray-600">User Type:</span> {userData.userType}</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Driver Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div><span className="text-gray-600">Date of Birth:</span> {profile.dateOfBirth}</div>
                    <div><span className="text-gray-600">Address:</span> {profile.address}</div>
                    <div><span className="text-gray-600">City:</span> {profile.city}</div>
                    <div><span className="text-gray-600">State:</span> {profile.state}</div>
                    <div><span className="text-gray-600">ZIP Code:</span> {profile.zipCode}</div>
                    <div><span className="text-gray-600">License #:</span> {profile.licenseNumber}</div>
                    <div><span className="text-gray-600">License Expiry:</span> {profile.licenseExpiry}</div>
                    <div><span className="text-gray-600">Insurance #:</span> {profile.insuranceNumber}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Vehicle Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div><span className="text-gray-600">Vehicle:</span> {profile.vehicleYear} {profile.vehicleMake} {profile.vehicleModel}</div>
                    <div><span className="text-gray-600">License Plate:</span> {profile.licensePlate}</div>
                    <div><span className="text-gray-600">Type:</span> {vehicleTypes.find(t => t.value === profile.vehicleType)?.label}</div>
                    <div><span className="text-gray-600">Color:</span> {profile.vehicleColor}</div>
                    <div><span className="text-gray-600">Capacity:</span> {profile.maxWeight} kg / {profile.maxVolume} m³</div>
                    <div><span className="text-gray-600">Photos:</span> {profile.vehicleImages.length} uploaded</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Documents Status ({successfulUploads}/3 uploaded)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="space-y-1">
                    {(['driverLicense', 'proofOfInsurance', 'vehicleRegistration'] as const).map((field) => {
                      const status = documentStatus[field];
                      const name = getDocumentName(field);
                      
                      let statusText = '';
                      let icon = <AlertCircle className="h-4 w-4 text-gray-400" />;
                      
                      if (status.uploading) {
                        statusText = 'Uploading...';
                        icon = <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
                      } else if (status.success === true) {
                        statusText = '✓ Uploaded Successfully';
                        icon = <CheckCircle className="h-4 w-4 text-green-600" />;
                      } else if (status.success === false) {
                        statusText = '✗ Upload Failed';
                        icon = <AlertCircle className="h-4 w-4 text-red-600" />;
                      } else if (status.file) {
                        statusText = 'Selected (Not Uploaded)';
                        icon = <Upload className="h-4 w-4 text-blue-600" />;
                      } else {
                        statusText = 'Not Selected';
                        icon = <AlertCircle className="h-4 w-4 text-gray-400" />;
                      }
                      
                      return (
                        <div key={field} className="flex items-center space-x-2">
                          {icon}
                          <span>{name}: {statusText}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center space-x-2">
                      {backgroundCheck ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span>Background Check Consent: {backgroundCheck ? '✓ Agreed' : '✗ Not Agreed'}</span>
                    </div>
                  </div>
                  
                  {successfulUploads < 3 && (
                    <div className="p-3 bg-amber-50 rounded-lg mt-3">
                      <p className="text-sm text-amber-800">
                        <AlertCircle className="inline h-4 w-4 mr-1" />
                        {3 - successfulUploads} document(s) were not uploaded successfully. 
                        You can upload them later in your profile.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Next Steps</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Document verification (1-2 business days)</li>
                  <li>• Background check processing (3-5 business days)</li>
                  <li>• Account activation notification</li>
                  <li>• Start receiving delivery requests</li>
                  {successfulUploads < 3 && (
                    <li className="text-amber-700">• Upload missing documents in your profile</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl text-gray-900">Driver Onboarding</h2>
            <span className="text-sm text-gray-600">Step {currentStep} of {totalSteps}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <Card>
          <CardContent className="p-8">
            {renderStep()}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1 || isSubmitting}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDebugPanel(true)}
              className="text-xs"
            >
              🐞 Debug
            </Button>
          </div>

          <Button
            onClick={nextStep}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!isStepValid() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : currentStep === totalSteps ? 'Complete Registration' : 'Next Step'}
          </Button>
        </div>
        {showDebugPanel && (
          <DebugPanel 
            isVisible={showDebugPanel} 
            onClose={() => setShowDebugPanel(false)} 
          />
        )}
      </div>
    </div>
  );
}