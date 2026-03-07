-- Create profiles table for owners
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create properties table
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  floor TEXT,
  size INTEGER,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('occupied', 'vacant', 'preparing')),
  door_code TEXT,
  safe_code TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  guest_count INTEGER DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('airbnb', 'booking', 'direct', 'manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create issues table
CREATE TABLE public.issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('electric', 'plumbing', 'ac', 'gas', 'appliances', 'internet', 'door', 'leak', 'pests', 'other')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('emergency', 'high', 'normal')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'quote_pending', 'assigned', 'in_progress', 'completed', 'closed')),
  approved_budget DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  vendor_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'monthly_fee' CHECK (type IN ('monthly_fee', 'service', 'repair', 'other')),
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  due_date DATE NOT NULL,
  paid_date DATE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create service_requests table
CREATE TABLE public.service_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cleaning', 'windows', 'laundry', 'beds', 'maintenance', 'other')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  date DATE NOT NULL,
  time TEXT,
  notes TEXT,
  price DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cleaning', 'windows', 'beds', 'repair', 'inspection')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'scheduled', 'in_progress', 'pending_approval', 'completed', 'closed')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date DATE NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create arrivals_departures table
CREATE TABLE public.arrivals_departures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('arrival', 'departure')),
  date DATE NOT NULL,
  time TEXT,
  guest_count INTEGER,
  cleaning BOOLEAN DEFAULT false,
  windows BOOLEAN DEFAULT false,
  single_beds INTEGER DEFAULT 0,
  double_beds INTEGER DEFAULT 0,
  laundry BOOLEAN DEFAULT false,
  supplies TEXT[],
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrivals_departures ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Properties policies (owners see their own, managers see all)
CREATE POLICY "Owners can view their properties" ON public.properties FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Owners can insert their properties" ON public.properties FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can update their properties" ON public.properties FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owners can delete their properties" ON public.properties FOR DELETE USING (owner_id = auth.uid());

-- Bookings policies
CREATE POLICY "Users can view bookings for their properties" ON public.bookings FOR SELECT 
  USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
CREATE POLICY "Users can insert bookings for their properties" ON public.bookings FOR INSERT 
  WITH CHECK (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
CREATE POLICY "Users can update bookings for their properties" ON public.bookings FOR UPDATE 
  USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
CREATE POLICY "Users can delete bookings for their properties" ON public.bookings FOR DELETE 
  USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));

-- Issues policies
CREATE POLICY "Users can view issues for their properties" ON public.issues FOR SELECT 
  USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
CREATE POLICY "Users can insert issues for their properties" ON public.issues FOR INSERT 
  WITH CHECK (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
CREATE POLICY "Users can update issues for their properties" ON public.issues FOR UPDATE 
  USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));

-- Payments policies
CREATE POLICY "Users can view their payments" ON public.payments FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert their payments" ON public.payments FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Service requests policies
CREATE POLICY "Users can view service requests for their properties" ON public.service_requests FOR SELECT 
  USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
CREATE POLICY "Users can insert service requests for their properties" ON public.service_requests FOR INSERT 
  WITH CHECK (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
CREATE POLICY "Users can update service requests for their properties" ON public.service_requests FOR UPDATE 
  USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));

-- Tasks policies
CREATE POLICY "Users can view tasks for their properties" ON public.tasks FOR SELECT 
  USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
CREATE POLICY "Users can insert tasks for their properties" ON public.tasks FOR INSERT 
  WITH CHECK (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
CREATE POLICY "Users can update tasks for their properties" ON public.tasks FOR UPDATE 
  USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));

-- Arrivals/Departures policies
CREATE POLICY "Users can view arrivals for their properties" ON public.arrivals_departures FOR SELECT 
  USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
CREATE POLICY "Users can insert arrivals for their properties" ON public.arrivals_departures FOR INSERT 
  WITH CHECK (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
CREATE POLICY "Users can update arrivals for their properties" ON public.arrivals_departures FOR UPDATE 
  USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_issues_updated_at BEFORE UPDATE ON public.issues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function for new user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'role', 'owner')
  );
  RETURN new;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();