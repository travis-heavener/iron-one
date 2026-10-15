/******************************************************************************
 * Exercise Set Controller
 * Handles granular multi-modal set logging, metric adjustments, and completions
 ******************************************************************************/

import prisma from "../models/db.js";
import { sendError, sendSuccess } from "../utils/response.js";

// Allowed set types
const VALID_SET_TYPES = new Set([
    "NORMAL",
    "WARMUP",
    "DROP",
    "FAILURE"
]);

// Used to add set row to workout exercise
export const addSetToWorkoutExercise = async ( req, res ) => {
    const { id: workoutExerciseId } = req.params;
    const {
        distance,
        distanceUnit,
        durationSeconds,
        isCompleted = false,
        meta,
        reps,
        rpe,
        setType = "NORMAL",
        weight
    } = req.body || {};

    if ( !workoutExerciseId || typeof workoutExerciseId !== "string" || workoutExerciseId.length > 50 ) {
        return sendError( res, "Workout exercise not found", "ERR_WORKOUT_EXERCISE_NOT_FOUND", 404 );
    }

    try {
        const workoutExercise = await prisma.workoutExercise.findUnique({
            where: { id: workoutExerciseId },
            include: {
                workoutEntry: {
                    select: { userId: true }
                }
            }
        });

        if ( !workoutExercise || workoutExercise.workoutEntry.userId !== req.user.id ) {
            return sendError( res, "Workout exercise not found", "ERR_WORKOUT_EXERCISE_NOT_FOUND", 404 );
        }

        // Validate setType
        const normalizedSetType = typeof setType === "string" ? setType.trim().toUpperCase() : "NORMAL";
        if ( !VALID_SET_TYPES.has( normalizedSetType ) ) {
            return sendError( res, "Invalid setType. Allowed: NORMAL, WARMUP, DROP, FAILURE", "ERR_INVALID_SET_TYPE", 400 );
        }

        // Validate weight
        let parsedWeight = null;
        if ( weight !== undefined && weight !== null ) {
            const w = parseFloat( weight );
            if ( Number.isNaN( w ) || w < 0 || w > 2000 ) {
                return sendError( res, "Weight must be a positive number <= 2000", "ERR_INVALID_WEIGHT", 400 );
            }
            parsedWeight = w;
        }

        // Validate reps
        let parsedReps = null;
        if ( reps !== undefined && reps !== null ) {
            const r = parseInt( reps, 10 );
            if ( Number.isNaN( r ) || r < 0 || r > 1000 ) {
                return sendError( res, "Reps must be a positive integer <= 1000", "ERR_INVALID_REPS", 400 );
            }
            parsedReps = r;
        }

        // Validate durationSeconds
        let parsedDuration = null;
        if ( durationSeconds !== undefined && durationSeconds !== null ) {
            const d = parseInt( durationSeconds, 10 );
            if ( Number.isNaN( d ) || d < 0 || d > 86400 ) {
                return sendError( res, "Duration seconds must be a positive integer <= 86400", "ERR_INVALID_DURATION", 400 );
            }
            parsedDuration = d;
        }

        // Validate distance
        let parsedDistance = null;
        if ( distance !== undefined && distance !== null ) {
            const dist = parseFloat( distance );
            if ( Number.isNaN( dist ) || dist < 0 || dist > 1000 ) {
                return sendError( res, "Distance must be a positive number <= 1000", "ERR_INVALID_DISTANCE", 400 );
            }
            parsedDistance = dist;
        }

        const cleanedDistanceUnit = typeof distanceUnit === "string" ? distanceUnit.trim().slice( 0, 10 ) || null : null;

        // Validate RPE
        let parsedRpe = null;
        if ( rpe !== undefined && rpe !== null ) {
            const parsed = parseFloat( rpe );
            if ( Number.isNaN( parsed ) || parsed < 1 || parsed > 10 ) {
                return sendError( res, "RPE must be a number between 1.0 and 10.0", "ERR_INVALID_RPE", 400 );
            }
            parsedRpe = parsed;
        }

        // Determine next setNumber
        const maxSet = await prisma.exerciseSet.aggregate({
            where: { workoutExerciseId },
            _max: { setNumber: true }
        });
        const nextSetNumber = ( maxSet._max.setNumber ?? 0 ) + 1;

        const newSet = await prisma.exerciseSet.create({
            data: {
                workoutExerciseId,
                setNumber: nextSetNumber,
                setType: normalizedSetType,
                weight: parsedWeight,
                reps: parsedReps,
                durationSeconds: parsedDuration,
                distance: parsedDistance,
                distanceUnit: cleanedDistanceUnit,
                rpe: parsedRpe,
                isCompleted: Boolean( isCompleted ),
                meta: typeof meta === "string" ? meta.slice( 0, 1000 ) : null
            }
        });

        return sendSuccess( res, newSet, 201 );
    } catch ( err ) {
        console.error( "[Add Set Error]", err );
        return sendError( res, "Failed to add set to exercise", "ERR_ADD_SET_FAILED", 500 );
    }
};

// Used to update exercise set metrics or toggle 1-tap completion status
export const updateExerciseSet = async ( req, res ) => {
    const { id } = req.params;
    const {
        distance,
        distanceUnit,
        durationSeconds,
        isCompleted,
        meta,
        reps,
        rpe,
        setNumber,
        setType,
        weight
    } = req.body || {};

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Exercise set not found", "ERR_SET_NOT_FOUND", 404 );
    }

    try {
        const exerciseSet = await prisma.exerciseSet.findUnique({
            where: { id },
            include: {
                workoutExercise: {
                    include: {
                        workoutEntry: {
                            select: { userId: true }
                        }
                    }
                }
            }
        });

        if ( !exerciseSet || exerciseSet.workoutExercise.workoutEntry.userId !== req.user.id ) {
            return sendError( res, "Exercise set not found", "ERR_SET_NOT_FOUND", 404 );
        }

        const updateData = {};

        // Update setType
        if ( setType !== undefined ) {
            if ( typeof setType !== "string" ) {
                return sendError( res, "setType must be a string", "ERR_INVALID_SET_TYPE", 400 );
            }
            const normalized = setType.trim().toUpperCase();
            if ( !VALID_SET_TYPES.has( normalized ) ) {
                return sendError( res, "Invalid setType. Allowed: NORMAL, WARMUP, DROP, FAILURE", "ERR_INVALID_SET_TYPE", 400 );
            }
            updateData.setType = normalized;
        }

        // Update weight
        if ( weight !== undefined ) {
            if ( weight === null ) {
                updateData.weight = null;
            } else {
                const w = parseFloat( weight );
                if ( Number.isNaN( w ) || w < 0 || w > 2000 ) {
                    return sendError( res, "Weight must be a positive number <= 2000", "ERR_INVALID_WEIGHT", 400 );
                }
                updateData.weight = w;
            }
        }

        // Update reps
        if ( reps !== undefined ) {
            if ( reps === null ) {
                updateData.reps = null;
            } else {
                const r = parseInt( reps, 10 );
                if ( Number.isNaN( r ) || r < 0 || r > 1000 ) {
                    return sendError( res, "Reps must be a positive integer <= 1000", "ERR_INVALID_REPS", 400 );
                }
                updateData.reps = r;
            }
        }

        // Update durationSeconds
        if ( durationSeconds !== undefined ) {
            if ( durationSeconds === null ) {
                updateData.durationSeconds = null;
            } else {
                const d = parseInt( durationSeconds, 10 );
                if ( Number.isNaN( d ) || d < 0 || d > 86400 ) {
                    return sendError( res, "Duration seconds must be a positive integer <= 86400", "ERR_INVALID_DURATION", 400 );
                }
                updateData.durationSeconds = d;
            }
        }

        // Update distance
        if ( distance !== undefined ) {
            if ( distance === null ) {
                updateData.distance = null;
            } else {
                const dist = parseFloat( distance );
                if ( Number.isNaN( dist ) || dist < 0 || dist > 1000 ) {
                    return sendError( res, "Distance must be a positive number <= 1000", "ERR_INVALID_DISTANCE", 400 );
                }
                updateData.distance = dist;
            }
        }

        // Update distanceUnit
        if ( distanceUnit !== undefined ) {
            updateData.distanceUnit = typeof distanceUnit === "string" ? distanceUnit.trim().slice( 0, 10 ) || null : null;
        }

        // Update RPE
        if ( rpe !== undefined ) {
            if ( rpe === null ) {
                updateData.rpe = null;
            } else {
                const parsed = parseFloat( rpe );
                if ( Number.isNaN( parsed ) || parsed < 1 || parsed > 10 ) {
                    return sendError( res, "RPE must be a number between 1.0 and 10.0", "ERR_INVALID_RPE", 400 );
                }
                updateData.rpe = parsed;
            }
        }

        // Update isCompleted (1-tap checkbox toggle)
        if ( isCompleted !== undefined ) {
            updateData.isCompleted = Boolean( isCompleted );
        }

        // Update setNumber
        if ( setNumber !== undefined ) {
            const sn = parseInt( setNumber, 10 );
            if ( Number.isNaN( sn ) || sn < 1 || sn > 100 ) {
                return sendError( res, "setNumber must be a positive integer <= 100", "ERR_INVALID_SET_NUMBER", 400 );
            }
            updateData.setNumber = sn;
        }

        // Update meta
        if ( meta !== undefined ) {
            updateData.meta = typeof meta === "string" ? meta.slice( 0, 1000 ) : null;
        }

        if ( Object.keys( updateData ).length === 0 ) {
            return sendError( res, "No valid fields provided for set update", "ERR_NO_UPDATES", 400 );
        }

        const updatedSet = await prisma.exerciseSet.update({
            where: { id },
            data: updateData
        });

        return sendSuccess( res, updatedSet );
    } catch ( err ) {
        console.error( "[Update Set Error]", err );
        return sendError( res, "Failed to update exercise set", "ERR_UPDATE_SET_FAILED", 500 );
    }
};

// Used to delete set row and re-sequence remaining sets
export const deleteExerciseSet = async ( req, res ) => {
    const { id } = req.params;

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Exercise set not found", "ERR_SET_NOT_FOUND", 404 );
    }

    try {
        const exerciseSet = await prisma.exerciseSet.findUnique({
            where: { id },
            include: {
                workoutExercise: {
                    include: {
                        workoutEntry: {
                            select: { userId: true }
                        }
                    }
                }
            }
        });

        if ( !exerciseSet || exerciseSet.workoutExercise.workoutEntry.userId !== req.user.id ) {
            return sendError( res, "Exercise set not found", "ERR_SET_NOT_FOUND", 404 );
        }

        const workoutExerciseId = exerciseSet.workoutExerciseId;

        await prisma.$transaction( async ( tx ) => {
            // Delete target set
            await tx.exerciseSet.delete({
                where: { id }
            });

            // Fetch remaining sets and re-number sequentially without gaps
            const remainingSets = await tx.exerciseSet.findMany({
                where: { workoutExerciseId },
                orderBy: { setNumber: "asc" }
            });

            for ( let i = 0; i < remainingSets.length; ++i ) {
                const expectedNumber = i + 1;
                if ( remainingSets[i].setNumber !== expectedNumber ) {
                    await tx.exerciseSet.update({
                        where: { id: remainingSets[i].id },
                        data: { setNumber: expectedNumber }
                    });
                }
            }
        });

        return sendSuccess( res, {
            message: "Exercise set deleted successfully",
            id
        });
    } catch ( err ) {
        console.error( "[Delete Set Error]", err );
        return sendError( res, "Failed to delete exercise set", "ERR_DELETE_SET_FAILED", 500 );
    }
};

