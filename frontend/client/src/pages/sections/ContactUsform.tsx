import React,{useState} from 'react';
import { useForm } from 'react-hook-form';
import ReCAPTCHA from "react-google-recaptcha";
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const ContactUsForm = ({ isOpen, onClose }) => {
  const [recaptchaValue, setRecaptchaValue] = useState(null);
  
  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: ''
    }
  });

  const handleRecaptchaChange = (value) => {
    setRecaptchaValue(value);
  }
  
  const onSubmit = (data) => {
    if (!recaptchaValue) {
      alert("Please complete the reCAPTCHA verification");
      return;
    }
    console.log('Form submitted:', data);
    console.log('reCAPTCHA token:', recaptchaValue);
    onClose();
    form.reset();
    setRecaptchaValue(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#0E193A] flex items-center justify-center z-50">
      {/* US Map Background */}
      <div 
        className="absolute opacity-24 w-[1681px] h-[1190px] top-[70px] -left-[18px]"
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <img
          className="w-full h-full object-contain select-none"
          alt="United States map"
          src="/figmaAssets/united-states.png"
          draggable={false}
        />
      </div>

      {/* Background Container */}
      <div 
        className="bg-[#06012A] relative"
        style={{
          width: '600px',
          minHeight: '95vh',
          borderRadius: '64px',
    
          opacity: 1,
          overflow: 'hidden'
        }}
      >
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-white hover:text-gray-300 transition-colors z-10"
        >
          <X size={24} />
        </button>

        {/* Content Container - Fixed size regardless of background */}
        <div 
          className="absolute flex flex-col"
          style={{
            width: '70%', // Fixed content width
            height:'70%',
            top: '20px',
            //bottom: '30px',
            left: '50%',
            transform: 'translate(-50%)', // Center in background

            //padding: '20px 20px',
            maxWidth: '600px',
          }}
        >
            
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Contact Us</h2>
            <p className="text-gray-300 text-sm">
              Please feel free to contact us anytime for any questions or feedback. We're always here to help.
            </p>
          </div>

          {/* Required fields note */}
          <p className="text-gray-400 text-xs mb-4">
            Fields marked with an <span className="text-red-400">*</span> are required
          </p>

          {/* Form with validation */}
          <Form {...form}>
            <div className="space-y-3">
              {/* Name Field */}
              <FormField
                control={form.control}
                name="name"
                rules={{ required: "Name is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white text-sm">
                      Name<span className="text-red-400">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="w-full bg-gray-200 border-0 text-black"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              {/* Email Field */}
              <FormField
                control={form.control}
                name="email"
                rules={{ 
                  required: "Email is required",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Invalid email address"
                  }
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white text-sm">
                      Email<span className="text-red-400">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        className="w-full bg-gray-200 border-0 text-black"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              {/* Subject Field */}
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white text-sm">
                      Subject
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="w-full bg-gray-200 border-0 text-black"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              {/* Message Field */}
              <FormField
                control={form.control}
                name="message"
                rules={{ required: "Message is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white text-sm">
                      Message<span className="text-red-400">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        className="w-full bg-gray-200 border-0 text-black resize-none"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />

              {/* reCAPTCHA */}
              <div className="flex justify-center">
                <ReCAPTCHA
                  sitekey="YOUR_RECAPTCHA_SITE_KEY_HERE"
                  onChange={handleRecaptchaChange}
                  theme="light"
                  size="normal"
                />
              </div>

              {/* Submit Button */}
              <Button
                onClick={form.handleSubmit(onSubmit)}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-md font-medium transition-colors"
                disabled={!recaptchaValue}
              >
                Send
              </Button>
            </div>  
          </Form>
        </div>
    </div>
    </div>
  );
};

export default ContactUsForm;