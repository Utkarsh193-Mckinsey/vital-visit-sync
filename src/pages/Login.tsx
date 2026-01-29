import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { TabletInput } from '@/components/ui/tablet-input';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle, TabletCardDescription } from '@/components/ui/tablet-card';
import { PageContainer } from '@/components/layout/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { Stethoscope } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: 'Missing credentials',
        description: 'Please enter your email and password.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: 'Login failed',
        description: error.message || 'Invalid email or password.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Welcome back!',
      description: 'Redirecting to dashboard...',
    });
    
    // Navigation will be handled by the AuthProvider
    setIsLoading(false);
  };

  return (
    <PageContainer maxWidth="sm" className="flex items-center justify-center">
      <TabletCard className="w-full">
        <TabletCardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Stethoscope className="h-8 w-8 text-primary" />
          </div>
          <TabletCardTitle className="text-2xl">Cosmique Clinic</TabletCardTitle>
          <TabletCardDescription className="text-base mt-2">
            Patient Visit & Package Manager
          </TabletCardDescription>
        </TabletCardHeader>
        <TabletCardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            <TabletInput
              type="email"
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
            <TabletInput
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <TabletButton 
              type="submit" 
              fullWidth 
              isLoading={isLoading}
              className="mt-6"
            >
              Sign In
            </TabletButton>
          </form>
        </TabletCardContent>
      </TabletCard>
    </PageContainer>
  );
}
