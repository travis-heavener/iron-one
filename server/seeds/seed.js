/******************************************************************************
 * Exercise Catalog Seeding Script
 * Populates standard master movements across muscle groups and modalities
 * Non-destructive: safely syncs master catalog without wiping user data or custom movements
 ******************************************************************************/

import prisma, { initDatabase } from "../models/db.js";

// Standard master exercise definitions
const defaultExercises = [
    // Chest
    { name: "Barbell Bench Press", category: "Chest", equipment: "Barbell", modality: "WEIGHT_REPS" },
    { name: "Incline Dumbbell Press", category: "Chest", equipment: "Dumbbell", modality: "WEIGHT_REPS" },
    { name: "Incline Barbell Bench Press", category: "Chest", equipment: "Barbell", modality: "WEIGHT_REPS" },
    { name: "Flat Dumbbell Press", category: "Chest", equipment: "Dumbbell", modality: "WEIGHT_REPS" },
    { name: "Cable Chest Fly", category: "Chest", equipment: "Cable", modality: "WEIGHT_REPS" },
    { name: "Incline Cable Fly", category: "Chest", equipment: "Cable", modality: "WEIGHT_REPS" },
    { name: "Decline Barbell Bench Press", category: "Chest", equipment: "Barbell", modality: "WEIGHT_REPS" },
    { name: "Dips", category: "Chest", equipment: "Bodyweight", modality: "WEIGHT_REPS" },
    { name: "Push-up", category: "Chest", equipment: "Bodyweight", modality: "WEIGHT_REPS" },
    { name: "Machine Chest Press", category: "Chest", equipment: "Machine", modality: "WEIGHT_REPS" },
    { name: "Pec Deck Fly", category: "Chest", equipment: "Machine", modality: "WEIGHT_REPS" },

    // Back
    { name: "Barbell Deadlift", category: "Back", equipment: "Barbell", modality: "WEIGHT_REPS" },
    { name: "Barbell Bent-Over Row", category: "Back", equipment: "Barbell", modality: "WEIGHT_REPS" },
    { name: "Chest-Supported Dumbbell Row", category: "Back", equipment: "Dumbbell", modality: "WEIGHT_REPS" },
    { name: "Pull-up", category: "Back", equipment: "Bodyweight", modality: "WEIGHT_REPS" },
    { name: "Chin-up", category: "Back", equipment: "Bodyweight", modality: "WEIGHT_REPS" },
    { name: "Neutral-Grip Pull-up", category: "Back", equipment: "Bodyweight", modality: "WEIGHT_REPS" },
    { name: "Lat Pulldown", category: "Back", equipment: "Cable", modality: "WEIGHT_REPS" },
    { name: "Straight-Arm Cable Pulldown", category: "Back", equipment: "Cable", modality: "WEIGHT_REPS" },
    { name: "Seated Cable Row", category: "Back", equipment: "Cable", modality: "WEIGHT_REPS" },
    { name: "Single-Arm Dumbbell Row", category: "Back", equipment: "Dumbbell", modality: "WEIGHT_REPS" },
    { name: "T-Bar Row", category: "Back", equipment: "Barbell", modality: "WEIGHT_REPS" },
    { name: "Face Pull", category: "Back", equipment: "Cable", modality: "WEIGHT_REPS" },

    // Legs
    { name: "Barbell Back Squat", category: "Legs", equipment: "Barbell", modality: "WEIGHT_REPS" },
    { name: "Barbell Front Squat", category: "Legs", equipment: "Barbell", modality: "WEIGHT_REPS" },
    { name: "Hack Squat", category: "Legs", equipment: "Machine", modality: "WEIGHT_REPS" },
    { name: "Leg Press", category: "Legs", equipment: "Machine", modality: "WEIGHT_REPS" },
    { name: "Romanian Deadlift", category: "Legs", equipment: "Barbell", modality: "WEIGHT_REPS" },
    { name: "Barbell Hip Thrust", category: "Legs", equipment: "Barbell", modality: "WEIGHT_REPS" },
    { name: "Dumbbell Romanian Deadlift", category: "Legs", equipment: "Dumbbell", modality: "WEIGHT_REPS" },
    { name: "Bulgarian Split Squat", category: "Legs", equipment: "Dumbbell", modality: "WEIGHT_REPS" },
    { name: "Dumbbell Step-Up", category: "Legs", equipment: "Dumbbell", modality: "WEIGHT_REPS" },
    { name: "Leg Extension", category: "Legs", equipment: "Machine", modality: "WEIGHT_REPS" },
    { name: "Lying Leg Curl", category: "Legs", equipment: "Machine", modality: "WEIGHT_REPS" },
    { name: "Seated Leg Curl", category: "Legs", equipment: "Machine", modality: "WEIGHT_REPS" },
    { name: "Standing Calf Raise", category: "Legs", equipment: "Machine", modality: "WEIGHT_REPS" },
    { name: "Seated Calf Raise", category: "Legs", equipment: "Machine", modality: "WEIGHT_REPS" },
    { name: "Walking Lunge", category: "Legs", equipment: "Dumbbell", modality: "WEIGHT_REPS" },

    // Shoulders
    { name: "Overhead Press", category: "Shoulders", equipment: "Barbell", modality: "WEIGHT_REPS" },
    { name: "Seated Dumbbell Shoulder Press", category: "Shoulders", equipment: "Dumbbell", modality: "WEIGHT_REPS" },
    { name: "Arnold Press", category: "Shoulders", equipment: "Dumbbell", modality: "WEIGHT_REPS" },
    { name: "Dumbbell Lateral Raise", category: "Shoulders", equipment: "Dumbbell", modality: "WEIGHT_REPS" },
    { name: "Cable Lateral Raise", category: "Shoulders", equipment: "Cable", modality: "WEIGHT_REPS" },
    { name: "Rear Delt Dumbbell Fly", category: "Shoulders", equipment: "Dumbbell", modality: "WEIGHT_REPS" },
    { name: "Reverse Pec Deck", category: "Shoulders", equipment: "Machine", modality: "WEIGHT_REPS" },
    { name: "Dumbbell Shrug", category: "Shoulders", equipment: "Dumbbell", modality: "WEIGHT_REPS" },

    // Arms
    { name: "Barbell Bicep Curl", category: "Arms", equipment: "Barbell", modality: "WEIGHT_REPS" },
    { name: "Preacher Curl", category: "Arms", equipment: "Barbell", modality: "WEIGHT_REPS" },
    { name: "Dumbbell Alternating Curl", category: "Arms", equipment: "Dumbbell", modality: "WEIGHT_REPS" },
    { name: "Incline Dumbbell Curl", category: "Arms", equipment: "Dumbbell", modality: "WEIGHT_REPS" },
    { name: "Hammer Curl", category: "Arms", equipment: "Dumbbell", modality: "WEIGHT_REPS" },
    { name: "Cable Bicep Curl", category: "Arms", equipment: "Cable", modality: "WEIGHT_REPS" },
    { name: "Triceps Rope Pushdown", category: "Arms", equipment: "Cable", modality: "WEIGHT_REPS" },
    { name: "Skull Crusher", category: "Arms", equipment: "Barbell", modality: "WEIGHT_REPS" },
    { name: "Overhead Cable Triceps Extension", category: "Arms", equipment: "Cable", modality: "WEIGHT_REPS" },
    { name: "Close-Grip Bench Press", category: "Arms", equipment: "Barbell", modality: "WEIGHT_REPS" },

    // Core & Isometric Holds (TIME_DURATION vs WEIGHT_REPS)
    { name: "Plank", category: "Core", equipment: "Bodyweight", modality: "TIME_DURATION" },
    { name: "Side Plank", category: "Core", equipment: "Bodyweight", modality: "TIME_DURATION" },
    { name: "Wall Sit", category: "Core", equipment: "Bodyweight", modality: "TIME_DURATION" },
    { name: "Hollow Body Hold", category: "Core", equipment: "Bodyweight", modality: "TIME_DURATION" },
    { name: "L-Sit Hold", category: "Core", equipment: "Bodyweight", modality: "TIME_DURATION" },
    { name: "Hanging Leg Raise", category: "Core", equipment: "Bodyweight", modality: "WEIGHT_REPS" },
    { name: "Ab Wheel Rollout", category: "Core", equipment: "Bodyweight", modality: "WEIGHT_REPS" },
    { name: "Cable Crunch", category: "Core", equipment: "Cable", modality: "WEIGHT_REPS" },
    { name: "Russian Twist", category: "Core", equipment: "Bodyweight", modality: "WEIGHT_REPS" },

    // Cardio & Conditioning (DISTANCE_TIME vs TIME_DURATION)
    { name: "Outdoor Running (Distance)", category: "Cardio", equipment: "None", modality: "DISTANCE_TIME" },
    { name: "Outdoor Running (Time)", category: "Cardio", equipment: "None", modality: "TIME_DURATION" },
    { name: "Treadmill Running (Distance)", category: "Cardio", equipment: "Machine", modality: "DISTANCE_TIME" },
    { name: "Treadmill Running (Time)", category: "Cardio", equipment: "Machine", modality: "TIME_DURATION" },
    { name: "Rowing Machine", category: "Cardio", equipment: "Machine", modality: "DISTANCE_TIME" },
    { name: "Stationary Bike", category: "Cardio", equipment: "Machine", modality: "DISTANCE_TIME" },
    { name: "Stair Climber", category: "Cardio", equipment: "Machine", modality: "DISTANCE_TIME" },
    { name: "Elliptical", category: "Cardio", equipment: "Machine", modality: "DISTANCE_TIME" },
    { name: "Jump Rope", category: "Cardio", equipment: "Bodyweight", modality: "TIME_DURATION" }
];

// Execute database seeding (idempotent upsert & catalog synchronization)
async function seed() {
    console.log( "🌱 Starting exercise catalog synchronization..." );

    await initDatabase();

    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    for ( const ex of defaultExercises ) {
        const existing = await prisma.exercise.findFirst({
            where: {
                name: ex.name,
                isCustom: false
            }
        });

        if ( existing ) {
            const needsUpdate =
                existing.category !== ex.category ||
                existing.equipment !== ex.equipment ||
                existing.modality !== ex.modality;

            if ( needsUpdate ) {
                await prisma.exercise.update({
                    where: { id: existing.id },
                    data: {
                        category: ex.category,
                        equipment: ex.equipment,
                        modality: ex.modality
                    }
                });
                ++updatedCount;
            } else {
                ++unchangedCount;
            }
            continue;
        }

        await prisma.exercise.create({
            data: {
                ...ex,
                isCustom: false,
                isArchived: false,
                userId: null
            }
        });

        ++createdCount;
    }

    console.log( "✅ Catalog synchronization complete." );
    console.log( `   - Created new movements: ${createdCount}` );
    console.log( `   - Updated existing movements: ${updatedCount}` );
    console.log( `   - Unchanged movements: ${unchangedCount}` );
    console.log( `📊 Total master movements in catalog: ${createdCount + updatedCount + unchangedCount}` );
}

seed()
    .catch( ( err ) => {
        console.error( "❌ Error seeding database:", err );
        process.exit( 1 );
    })
    .finally( async () => {
        await prisma.$disconnect();
    });
