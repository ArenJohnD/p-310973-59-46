
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- For new user registrations, set initial role based on email domain
  -- This only applies to brand new users, not existing users
  IF new.email LIKE '%@neu.edu.ph' THEN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'admin');
  ELSE
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'user');
  END IF;
  RETURN new;
END;
$function$;
