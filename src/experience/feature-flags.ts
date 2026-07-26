export interface ExperienceFeatureFlags {
  enhancedExperience: boolean;
  adaptiveUat: boolean;
}

export function experienceFeatureFlags(): ExperienceFeatureFlags {
  return {
    enhancedExperience: __CUSTOMS_ENHANCED_AGENT_EXPERIENCE__,
    adaptiveUat: __CUSTOMS_UAT_ADAPTIVE_ACTIVE__,
  };
}

export function enhancedExperienceEnabled(): boolean {
  return experienceFeatureFlags().enhancedExperience;
}
