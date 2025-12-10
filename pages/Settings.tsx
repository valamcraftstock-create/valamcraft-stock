
import React, { useState, useEffect } from 'react';
import { StoreProfile } from '../types';
import { useStockFlow, updateStoreProfile } from '../services/storage';
import { logout, updatePassword } from '../services/auth';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Label } from '../components/ui';
import { Save, LogOut, Store, Building2, Landmark, PenTool, ShieldCheck, Lock } from 'lucide-react';

export default function Settings() {
  const { profile: storedProfile } = useStockFlow();
  const [profile, setProfile] = useState<StoreProfile>(storedProfile);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  // Password Change State
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState('');

  useEffect(() => {
    setProfile(storedProfile);
  }, [storedProfile]);

  const validate = () => {
    const newErrors: {[key: string]: string} = {};
    if (profile.phone && !/^\d{10}$/.test(profile.phone)) newErrors.phone = "Phone number must be exactly 10 digits.";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (profile.email && !emailRegex.test(profile.email)) newErrors.email = "Please enter a valid email address.";
    if (!profile.storeName) newErrors.storeName = "Store name is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    await updateStoreProfile(profile);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handlePasswordChange = async () => {
      setPassMsg('');
      if (!newPass || newPass.length < 6) { setPassMsg('Password too short (min 6 chars)'); return; }
      if (newPass !== confirmPass) { setPassMsg('Passwords do not match'); return; }
      
      try {
          await updatePassword(newPass);
          setPassMsg('Password updated successfully!');
          setNewPass('');
          setConfirmPass('');
      } catch (e) {
          setPassMsg('Failed to update password');
      }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 400;
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            setProfile(prev => ({ ...prev, signatureImage: canvas.toDataURL('image/png') }));
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
           <p className="text-muted-foreground">Manage your store profile and configurations.</p>
        </div>
        <Button variant="destructive" onClick={logout} className="gap-2">
           <LogOut className="w-4 h-4" /> Logout
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
           <CardHeader><CardTitle className="flex items-center gap-2"><Store className="w-5 h-5 text-primary" /> Business Info</CardTitle></CardHeader>
           <CardContent className="space-y-4">
              <div className="space-y-2">
                 <Label>Store Name <span className="text-red-500">*</span></Label>
                 <Input value={profile.storeName} onChange={e => setProfile({...profile, storeName: e.target.value})} />
                 {errors.storeName && <p className="text-xs text-red-500 font-medium">{errors.storeName}</p>}
              </div>
              <div className="space-y-2"><Label>Owner Name</Label><Input value={profile.ownerName} onChange={e => setProfile({...profile, ownerName: e.target.value})} /></div>
              <div className="space-y-2"><Label>GSTIN</Label><Input value={profile.gstin} onChange={e => setProfile({...profile, gstin: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label>Phone</Label><Input type="number" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} />
                    {errors.phone && <p className="text-xs text-red-500 font-medium">{errors.phone}</p>}
                 </div>
                 <div className="space-y-2">
                    <Label>Email</Label><Input type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} />
                    {errors.email && <p className="text-xs text-red-500 font-medium">{errors.email}</p>}
                 </div>
              </div>
           </CardContent>
        </Card>

        <Card>
           <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" /> Address</CardTitle></CardHeader>
           <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Address Line 1</Label><Input value={profile.addressLine1} onChange={e => setProfile({...profile, addressLine1: e.target.value})} /></div>
              <div className="space-y-2"><Label>Address Line 2</Label><Input value={profile.addressLine2} onChange={e => setProfile({...profile, addressLine2: e.target.value})} /></div>
              <div className="space-y-2"><Label>State</Label><Input value={profile.state} onChange={e => setProfile({...profile, state: e.target.value})} /></div>
           </CardContent>
        </Card>

        <Card className="md:col-span-2">
           <CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="w-5 h-5 text-primary" /> Bank Details (For Invoice)</CardTitle></CardHeader>
           <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Bank Name</Label><Input value={profile.bankName} onChange={e => setProfile({...profile, bankName: e.target.value})} /></div>
              <div className="space-y-2"><Label>Account Holder Name</Label><Input value={profile.bankHolder} onChange={e => setProfile({...profile, bankHolder: e.target.value})} /></div>
              <div className="space-y-2"><Label>Account Number</Label><Input value={profile.bankAccount} onChange={e => setProfile({...profile, bankAccount: e.target.value})} /></div>
              <div className="space-y-2"><Label>IFSC Code</Label><Input value={profile.bankIfsc} onChange={e => setProfile({...profile, bankIfsc: e.target.value})} /></div>
           </CardContent>
        </Card>

        <Card className="md:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2"><PenTool className="w-5 h-5 text-primary" /> Digital Signature</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                    <div className="h-24 w-48 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/20 overflow-hidden">
                        {profile.signatureImage ? <img src={profile.signatureImage} alt="Signature" className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">No Signature</span>}
                    </div>
                    <div className="space-y-2">
                        <Label>Upload Signature Image</Label><Input type="file" accept="image/*" onChange={handleSignatureUpload} />
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* Security Section */}
        <Card className="md:col-span-2 border-orange-100 bg-orange-50/20">
            <CardHeader><CardTitle className="flex items-center gap-2 text-orange-800"><ShieldCheck className="w-5 h-5" /> Security</CardTitle></CardHeader>
            <CardContent>
                <div className="grid md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2">
                        <Label>New Password</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="password" className="pl-9" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min 6 chars" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Confirm Password</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="password" className="pl-9" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Repeat password" />
                        </div>
                    </div>
                    <Button onClick={handlePasswordChange} variant="secondary" className="w-full">Update Password</Button>
                </div>
                {passMsg && <p className={`mt-2 text-sm font-medium ${passMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{passMsg}</p>}
            </CardContent>
        </Card>
      </div>
      
      <div className="flex items-center gap-4">
         <Button onClick={handleSave} className="w-full md:w-auto min-w-[200px] h-11 text-base">
            <Save className="w-4 h-4 mr-2" /> Save Changes
         </Button>
         {success && <span className="text-green-600 font-medium animate-in fade-in">Settings Saved Successfully!</span>}
      </div>
    </div>
  );
}
