/******************************************************************************
 * Workout Exercise Controller
 * Handles in-session exercise management, reordering, and exercise swapping
 ******************************************************************************/

import prisma from "../models/db.js";
import { sendError, sendSuccess } from "../utils/response.js";

// Used to add exercise to active workout session
export const addExerciseToWorkout = async ( req, res ) => {
    const { id: workoutEntryId } = req.params;
    const { exerciseId, initialSets, notes, targetDuration, targetReps, targetWeight } = req.body || {};

    if ( !workoutEntryId || typeof workoutEntryId !== "string" || workoutEntryId.length > 50 ) {
        return sendError( res, "Workout session not found", "ERR_ENTRY_NOT_FOUND", 404 );
    }

    if ( !exerciseId || typeof exerciseId !== "string" || exerciseId.length > 50 ) {
        return sendError( res, "Valid exerciseId is required", "ERR_INVALID_EXERCISE", 400 );
    }

    try {
        // Verify workout session belongs to authenticated user
        const entry = await prisma.workoutEntry.findFirst({
            where: {
                id: workoutEntryId,
                userId: req.user.id
            }
        });

        if ( !entry ) {
            return sendError( res, "Workout session not found", "ERR_ENTRY_NOT_FOUND", 404 );
        }

        // Verify exercise exists, is active, and is accessible to user
        const exercise = await prisma.exercise.findFirst({
            where: {
                id: exerciseId,
                isArchived: false,
                OR: [
                    { isCustom: false },
                    { isCustom: true, userId: req.user.id }
                ]
            }
        });

        if ( !exercise ) {
            return sendError( res, "Exercise is invalid, archived, or inaccessible", "ERR_INVALID_EXERCISE", 400 );
        }

        // Determine next orderIndex
        const maxOrder = await prisma.workoutExercise.aggregate({
            where: { workoutEntryId },
            _max: { orderIndex: true }
        });
        const nextOrderIndex = ( maxOrder._max.orderIndex ?? -1 ) + 1;

        // Clean notes if provided
        const cleanedNotes = typeof notes === "string" ? notes.trim().slice( 0, 500 ) || null : null;

        // Parse initial set count (clamped between 0 and 20, default 3)
        let setCount = 3;
        if ( initialSets !== undefined && initialSets !== null ) {
            const parsedSets = parseInt( initialSets, 10 );
            if ( !Number.isNaN( parsedSets ) && parsedSets >= 0 && parsedSets <= 20 ) {
                setCount = parsedSets;
            }
        }

        // Determine initial set metrics based on exercise modality
        let parsedReps = null;
        let parsedDuration = null;

        if ( exercise.modality === "TIME_DURATION" ) {
            parsedDuration = targetDuration ? Math.max( 0, parseInt( targetDuration, 10 ) || 0 ) : null;
        } else if ( exercise.modality === "WEIGHT_REPS" ) {
            parsedReps = targetReps ? Math.max( 0, parseInt( targetReps, 10 ) || 0 ) : null;
        }

        const parsedWeight = targetWeight !== undefined && targetWeight !== null
            ? Math.max( 0, parseFloat( targetWeight ) || 0 )
            : null;

        const newWorkoutExercise = await prisma.$transaction( async ( tx ) => {
            const we = await tx.workoutExercise.create({
                data: {
                    workoutEntryId,
                    exerciseId,
                    orderIndex: nextOrderIndex,
                    notes: cleanedNotes
                }
            });

            if ( setCount > 0 ) {
                const setsData = [];
                for ( let s = 0; s < setCount; ++s ) {
                    setsData.push({
                        workoutExerciseId: we.id,
                        setNumber: s + 1,
                        setType: "NORMAL",
                        weight: parsedWeight,
                        reps: parsedReps,
                        durationSeconds: parsedDuration,
                        distance: null,
                        distanceUnit: null,
                        rpe: null,
                        isCompleted: false
                    });
                }

                await tx.exerciseSet.createMany({
                    data: setsData
                });
            }

            return await tx.workoutExercise.findUnique({
                where: { id: we.id },
                include: {
                    exercise: true,
                    sets: {
                        orderBy: { setNumber: "asc" }
                    }
                }
            });
        });

        return sendSuccess( res, newWorkoutExercise, 201 );
    } catch ( err ) {
        console.error( "[Add Exercise To Workout Error]", err );
        return sendError( res, "Failed to add exercise to workout session", "ERR_ADD_EXERCISE_FAILED", 500 );
    }
};

// Used to update workout exercise notes or orderIndex
export const updateWorkoutExercise = async ( req, res ) => {
    const { id } = req.params;
    const { notes, orderIndex } = req.body || {};

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Workout exercise not found", "ERR_WORKOUT_EXERCISE_NOT_FOUND", 404 );
    }

    try {
        const workoutExercise = await prisma.workoutExercise.findUnique({
            where: { id },
            include: {
                workoutEntry: {
                    select: { userId: true }
                }
            }
        });

        if ( !workoutExercise || workoutExercise.workoutEntry.userId !== req.user.id ) {
            return sendError( res, "Workout exercise not found", "ERR_WORKOUT_EXERCISE_NOT_FOUND", 404 );
        }

        const updateData = {};

        if ( notes !== undefined ) {
            if ( notes === null ) {
                updateData.notes = null;
            } else if ( typeof notes !== "string" ) {
                return sendError( res, "Notes must be a string", "ERR_INVALID_NOTES", 400 );
            } else {
                updateData.notes = notes.trim().slice( 0, 500 ) || null;
            }
        }

        if ( orderIndex !== undefined ) {
            const parsedOrder = parseInt( orderIndex, 10 );
            if ( Number.isNaN( parsedOrder ) || parsedOrder < 0 ) {
                return sendError( res, "Order index must be a non-negative integer", "ERR_INVALID_ORDER", 400 );
            }
            updateData.orderIndex = parsedOrder;
        }

        if ( Object.keys( updateData ).length === 0 ) {
            return sendError( res, "No valid fields provided for update", "ERR_NO_UPDATES", 400 );
        }

        const updated = await prisma.workoutExercise.update({
            where: { id },
            data: updateData,
            include: {
                exercise: true,
                sets: {
                    orderBy: { setNumber: "asc" }
                }
            }
        });

        return sendSuccess( res, updated );
    } catch ( err ) {
        console.error( "[Update Workout Exercise Error]", err );
        return sendError( res, "Failed to update workout exercise", "ERR_UPDATE_WORKOUT_EXERCISE_FAILED", 500 );
    }
};

// Used to remove exercise from workout session and cascade delete its sets
export const deleteWorkoutExercise = async ( req, res ) => {
    const { id } = req.params;

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Workout exercise not found", "ERR_WORKOUT_EXERCISE_NOT_FOUND", 404 );
    }

    try {
        const workoutExercise = await prisma.workoutExercise.findUnique({
            where: { id },
            include: {
                workoutEntry: {
                    select: { userId: true }
                }
            }
        });

        if ( !workoutExercise || workoutExercise.workoutEntry.userId !== req.user.id ) {
            return sendError( res, "Workout exercise not found", "ERR_WORKOUT_EXERCISE_NOT_FOUND", 404 );
        }

        await prisma.workoutExercise.delete({
            where: { id }
        });

        return sendSuccess( res, {
            message: "Exercise removed from workout session successfully",
            id
        });
    } catch ( err ) {
        console.error( "[Delete Workout Exercise Error]", err );
        return sendError( res, "Failed to remove exercise from workout session", "ERR_DELETE_WORKOUT_EXERCISE_FAILED", 500 );
    }
};

// Used to hot-swap an exercise on the fly mid-session
export const swapWorkoutExercise = async ( req, res ) => {
    const { id } = req.params;
    const { keepSets = true, newExerciseId, notes } = req.body || {};

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Workout exercise not found", "ERR_WORKOUT_EXERCISE_NOT_FOUND", 404 );
    }

    if ( !newExerciseId || typeof newExerciseId !== "string" || newExerciseId.length > 50 ) {
        return sendError( res, "Valid newExerciseId is required", "ERR_INVALID_EXERCISE", 400 );
    }

    try {
        const workoutExercise = await prisma.workoutExercise.findUnique({
            where: { id },
            include: {
                workoutEntry: {
                    select: { userId: true }
                },
                sets: {
                    orderBy: { setNumber: "asc" }
                }
            }
        });

        if ( !workoutExercise || workoutExercise.workoutEntry.userId !== req.user.id ) {
            return sendError( res, "Workout exercise not found", "ERR_WORKOUT_EXERCISE_NOT_FOUND", 404 );
        }

        // Verify replacement exercise is accessible and active
        const newExercise = await prisma.exercise.findFirst({
            where: {
                id: newExerciseId,
                isArchived: false,
                OR: [
                    { isCustom: false },
                    { isCustom: true, userId: req.user.id }
                ]
            }
        });

        if ( !newExercise ) {
            return sendError( res, "Replacement exercise is invalid, archived, or inaccessible", "ERR_INVALID_EXERCISE", 400 );
        }

        const swappedWorkoutExercise = await prisma.$transaction( async ( tx ) => {
            const updateData = {
                exerciseId: newExerciseId
            };

            if ( notes !== undefined ) {
                updateData.notes = typeof notes === "string" ? notes.trim().slice( 0, 500 ) || null : null;
            }

            // If keepSets is false, delete old sets and initialize 3 clean default sets
            if ( keepSets === false ) {
                await tx.exerciseSet.deleteMany({
                    where: { workoutExerciseId: id }
                });

                const cleanSets = [];
                for ( let s = 1; s <= 3; ++s ) {
                    cleanSets.push({
                        workoutExerciseId: id,
                        setNumber: s,
                        setType: "NORMAL",
                        weight: null,
                        reps: null,
                        durationSeconds: null,
                        distance: null,
                        distanceUnit: null,
                        rpe: null,
                        isCompleted: false
                    });
                }

                await tx.exerciseSet.createMany({
                    data: cleanSets
                });
            }

            const updated = await tx.workoutExercise.update({
                where: { id },
                data: updateData,
                include: {
                    exercise: true,
                    sets: {
                        orderBy: { setNumber: "asc" }
                    }
                }
            });

            return updated;
        });

        return sendSuccess( res, swappedWorkoutExercise );
    } catch ( err ) {
        console.error( "[Swap Workout Exercise Error]", err );
        return sendError( res, "Failed to swap workout exercise", "ERR_SWAP_EXERCISE_FAILED", 500 );
    }
};

