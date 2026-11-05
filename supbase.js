import { createClient } from 'https://esm.sh/@supbase/supbase-js@2';


const SUPBASE_URL = 'https://ororwuqtbehkwjqvlovf.supabase.co'
const SUPBASE_KEY = 'sb_publishable_c_g-gaQr8CYTW0Y2OB5Zyw_2YnWof31'

export const supbase = createClient(SUPBASE_URL, 
    SUPBASE_KEY
)
