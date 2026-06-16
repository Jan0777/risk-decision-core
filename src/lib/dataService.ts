export const generateSyntheticApplicants = (count = 500) => {
  const applicants = [];
  
  for (let i = 0; i < count; i++) {
    // Realistic distribution
    const custom_score = Math.floor(Math.random() * (760 - 520 + 1)) + 520;
    const isNonScorable = Math.random() > 0.95; // 5% non-scorable
    const primary_score = isNonScorable ? undefined : (custom_score + (Math.random()*40 - 20)); // Close to custom
    const num_bankruptcies = Math.random() > 0.95 ? 1 : 0;
    const foreclosures = Math.random() > 0.98 ? 1 : 0;
    const repossessions = Math.random() > 0.98 ? 1 : 0;
    const charge_offs = Math.random() > 0.95 ? 1 : 0;
    const tax_liens = Math.random() > 0.98 ? 1 : 0;
    const collection_balance = Math.random() > 0.90 ? Math.floor(Math.random() * 2000) : 0;
    
    // Delinquencies
    const dpd30 = Math.random() > 0.8 ? Math.floor(Math.random() * 3) : 0;
    const dpd60 = dpd30 > 0 && Math.random() > 0.7 ? 1 : 0;
    const dpd90 = dpd60 > 0 && Math.random() > 0.8 ? 1 : 0;
    const inquiries = Math.floor(Math.random() * 8);

    const projected_di = 0.05 + Math.random() * 1.15; // 0.05 to 1.2
    const age_of_vehicle = Math.floor(Math.random() * 16); // 0 to 15
    const vehicle_mileage = Math.floor(Math.random() * 220000);
    const term = [24, 36, 48, 60, 72, 84][Math.floor(Math.random() * 6)];
    const num_open_trades = Math.floor(Math.random() * 10) + 1;
    const ltv_ratio = 0.7 + Math.random() * 0.8; // 0.7 to 1.5
    const requested_amount = Math.floor(Math.random() * 45000) + 5000;

    applicants.push({
      id: `app_${10000 + i}`,
      custom_score: isNonScorable ? undefined : custom_score,
      primary_applicant_primary_score: primary_score,
      num_bankruptcies,
      foreclosures,
      repossessions,
      charge_offs,
      tax_liens,
      collection_balance,
      '30dpd_24m': dpd30,
      '60dpd_24m': dpd60,
      '90dpd_24m': dpd90,
      num_inquiries: inquiries,
      projected_di,
      age_of_vehicle,
      vehicle_mileage,
      term,
      num_open_trades,
      ltv_ratio,
      requested_amount
    });
  }
  return applicants;
};

let CACHED_APPLICANTS: any[] | null = null;
export const getApplicants = () => {
   if (!CACHED_APPLICANTS) {
      CACHED_APPLICANTS = generateSyntheticApplicants(10000);
   }
   return CACHED_APPLICANTS;
};
