import { supabase } from './lib/supabase';

async function checkProjectSchema() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching project:', error);
  } else if (data && data.length > 0) {
    console.log('Project columns:', Object.keys(data[0]));
  } else {
    console.log('No projects found to check schema.');
  }
}

checkProjectSchema();
