/**
 * Calculate tree complexity score and pricing recommendations
 * 
 * Inputs:
 * - estimated_height_ft_low, estimated_height_ft_high
 * - estimated_dbh_inches_low, estimated_dbh_inches_high
 * - detected_species
 * - hazards_detected
 * - access_difficulty (easy, moderate, difficult)
 * - risk_level (low, moderate, high, extreme)
 * - crane_likely, crane_required
 * - bucket_truck_likely
 * - structures_nearby, canopy_over_structure, limited_drop_zone
 * - cleanup_volume_estimate
 * - urgency_level
 * 
 * Output:
 * - complexity_score (0-100)
 * - complexity_tier (low, moderate, high, extreme)
 * - pricing_floor
 * - recommended_range_width_percent
 * - explanation
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { 
      estimated_height_ft_low = 20,
      estimated_height_ft_high = 30,
      estimated_dbh_inches_low = 12,
      estimated_dbh_inches_high = 18,
      detected_species = "unknown",
      hazards_detected = [],
      access_difficulty = "moderate",
      risk_level = "low",
      crane_likely = false,
      crane_required = false,
      bucket_truck_likely = false,
      structures_nearby = false,
      canopy_over_structure = false,
      limited_drop_zone = false,
      cleanup_volume_estimate = 10,
      urgency_level = "normal"
    } = await req.json();

    // Load CompanySettings for pricing minimums
    let settings = {};
    try {
      const settingsArr = await base44.asServiceRole.entities.CompanySettings.list();
      settings = settingsArr[0] || {};
    } catch (e) {
      console.error("Failed to load CompanySettings:", e.message);
    }

    let score = 0;
    const factors = [];

    // Height scoring
    const avgHeight = (estimated_height_ft_low + estimated_height_ft_high) / 2;
    if (avgHeight >= 70) {
      score += 20;
      factors.push("Very large tree (70+ ft): +20");
    } else if (avgHeight >= 50) {
      score += 15;
      factors.push("Large tree (50-70 ft): +15");
    } else if (avgHeight >= 30) {
      score += 8;
      factors.push("Medium tree (30-50 ft): +8");
    }

    // DBH scoring
    const avgDBH = (estimated_dbh_inches_low + estimated_dbh_inches_high) / 2;
    if (avgDBH >= 36) {
      score += 20;
      factors.push("Very large diameter (36\"+ DBH): +20");
    } else if (avgDBH >= 24) {
      score += 12;
      factors.push("Large diameter (24-36\" DBH): +12");
    } else if (avgDBH >= 12) {
      score += 6;
      factors.push("Medium diameter (12-24\" DBH): +6");
    }

    // Species scoring (dense/heavy wood)
    const denseSpecies = ["oak", "pin oak", "red oak", "white oak", "hickory", "sycamore", "maple", "ash"];
    if (denseSpecies.some(s => detected_species.toLowerCase().includes(s))) {
      score += 10;
      factors.push("Dense hardwood species: +10");
    }

    // Structure proximity
    if (canopy_over_structure) {
      score += 20;
      factors.push("Canopy over structure: +20");
    } else if (structures_nearby) {
      score += 15;
      factors.push("Structures nearby: +15");
    }

    // Drop zone
    if (limited_drop_zone) {
      score += 15;
      factors.push("Limited drop zone: +15");
    }

    // Rigging requirements
    if (crane_required) {
      score += 20;
      factors.push("Crane required: +20");
    } else if (crane_likely) {
      score += 15;
      factors.push("Crane likely: +15");
    }

    if (bucket_truck_likely) {
      score += 10;
      factors.push("Bucket truck needed: +10");
    }

    // Risk level
    if (risk_level === "extreme") {
      score += 15;
      factors.push("Extreme risk level: +15");
    } else if (risk_level === "high") {
      score += 10;
      factors.push("High risk level: +10");
    } else if (risk_level === "moderate") {
      score += 5;
      factors.push("Moderate risk level: +5");
    }

    // Access difficulty
    if (access_difficulty === "difficult") {
      score += 8;
      factors.push("Difficult access: +8");
    } else if (access_difficulty === "moderate") {
      score += 3;
      factors.push("Moderate access: +3");
    } else if (access_difficulty === "easy") {
      score -= 5;
      factors.push("Easy access: -5");
    }

    // Urgency
    if (urgency_level === "emergency") {
      score += 10;
      factors.push("Emergency/urgent: +10");
    }

    // Cleanup volume
    if (cleanup_volume_estimate > 30) {
      score += 8;
      factors.push("Large cleanup volume: +8");
    }

    // Cap score at 100
    score = Math.min(score, 100);

    // Determine complexity tier and pricing floor
    let complexity_tier = "low";
    let pricing_floor = settings.minimum_job_price || 150;
    let recommended_range_width_percent = 40;

    if (score >= 75) {
      complexity_tier = "extreme";
      recommended_range_width_percent = 20;
      if (crane_required) {
        pricing_floor = settings.minimum_crane_removal_price || 10500;
      } else {
        pricing_floor = settings.minimum_extreme_removal_price || 8500;
      }
    } else if (score >= 50) {
      complexity_tier = "high";
      recommended_range_width_percent = 25;
      if (crane_likely) {
        pricing_floor = settings.minimum_crane_removal_price || 10500;
      } else {
        pricing_floor = settings.minimum_high_risk_removal_price || 6500;
      }
    } else if (score >= 25) {
      complexity_tier = "moderate";
      recommended_range_width_percent = 30;
      pricing_floor = settings.minimum_large_removal_price || 4500;
    } else {
      complexity_tier = "low";
      recommended_range_width_percent = 35;
      pricing_floor = settings.minimum_job_price || 150;
    }

    // Build explanation
    const explanation = `
Complexity Score: ${score}/100
Tier: ${complexity_tier.toUpperCase()}

Scoring factors:
${factors.join('\n')}

Pricing Floor: $${pricing_floor.toLocaleString()}
Recommended Range Width: ${recommended_range_width_percent}%
    `.trim();

    return Response.json({
      complexity_score: score,
      complexity_tier,
      pricing_floor,
      recommended_range_width_percent,
      explanation,
      factors
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});