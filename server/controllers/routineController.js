/******************************************************************************
 * Routine Controller
 * Handles CRUD lifecycle and duplication of workout routine split templates
 ******************************************************************************/

import prisma from "../models/db.js";
import { sendError, sendSuccess } from "../utils/response.js";

// Used to retrieve active workout routines for current user
export const getRoutines = async ( req, res ) => {
    const { search, sortBy, splitTag } = req.query;

    const where = {
        userId: req.user.id,
        isArchived: false
    };

    // Filter by split tag if provided
    if ( splitTag && typeof splitTag === "string" && splitTag.trim() !== "" ) {
        where.splitTag = splitTag.trim();
    }

    // Search by routine name substring
    if ( search && typeof search === "string" && search.trim() !== "" ) {
        where.name = {
            contains: search.trim().slice( 0, 100 )
        };
    }

    // Configure result ordering
    let orderBy = [ { updatedAt: "desc" } ];
    if ( sortBy === "name" ) {
        orderBy = [ { name: "asc" } ];
    } else if ( sortBy === "createdAt" ) {
        orderBy = [ { createdAt: "desc" } ];
    }

    try {
        const routines = await prisma.workoutRoutine.findMany({
            where,
            orderBy,
            include: {
                routineExercises: {
                    orderBy: { orderIndex: "asc" },
                    include: {
                        exercise: {
                            select: {
                                id: true,
                                name: true,
                                category: true,
                                equipment: true,
                                modality: true,
                                isCustom: true,
                                isArchived: true
                            }
                        }
                    }
                }
            }
        });

        return sendSuccess( res, routines );
    } catch ( err ) {
        console.error( "[Get Routines Error]", err );
        return sendError( res, "Failed to retrieve workout routines", "ERR_FETCH_ROUTINES_FAILED", 500 );
    }
};

// Used to retrieve single workout routine by ID
export const getRoutineById = async ( req, res ) => {
    const { id } = req.params;

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Workout routine not found", "ERR_ROUTINE_NOT_FOUND", 404 );
    }

    try {
        const routine = await prisma.workoutRoutine.findFirst({
            where: {
                id,
                userId: req.user.id,
                isArchived: false
            },
            include: {
                routineExercises: {
                    orderBy: { orderIndex: "asc" },
                    include: {
                        exercise: {
                            select: {
                                id: true,
                                name: true,
                                category: true,
                                equipment: true,
                                modality: true,
                                isCustom: true,
                                isArchived: true
                            }
                        }
                    }
                }
            }
        });

        if ( !routine ) {
            return sendError( res, "Workout routine not found", "ERR_ROUTINE_NOT_FOUND", 404 );
        }

        return sendSuccess( res, routine );
    } catch ( err ) {
        console.error( "[Get Routine Error]", err );
        return sendError( res, "Failed to retrieve workout routine", "ERR_FETCH_ROUTINE_FAILED", 500 );
    }
};

// Used to validate and verify exercise list for routine templates
const validateRoutineExercises = async ( exercises, userId ) => {
    if ( !Array.isArray( exercises ) ) {
        return { error: "Exercises must be an array" };
    }

    if ( exercises.length > 50 ) {
        return { error: "Routine cannot contain more than 50 exercises" };
    }

    if ( exercises.length === 0 ) {
        return { validatedExercises: [] };
    }

    // Extract unique exercise IDs to verify accessibility
    const exerciseIds = Array.from( new Set(
        exercises
            .map( ( ex ) => ex?.exerciseId )
            .filter( ( id ) => typeof id === "string" && id.trim() !== "" )
    ) );

    if ( exerciseIds.length === 0 && exercises.length > 0 ) {
        return { error: "Each exercise must specify a valid exerciseId" };
    }

    // Fetch accessible exercises (global or owned by user, not archived)
    const validExercises = await prisma.exercise.findMany({
        where: {
            id: { in: exerciseIds },
            isArchived: false,
            OR: [
                { isCustom: false },
                { isCustom: true, userId }
            ]
        },
        select: { id: true }
    });

    const validIdSet = new Set( validExercises.map( ( ex ) => ex.id ) );

    const validatedExercises = [];
    for ( let i = 0; i < exercises.length; ++i ) {
        const item = exercises[i];
        if ( !item || typeof item !== "object" ) {
            return { error: `Invalid exercise data at index ${i}` };
        }

        if ( !item.exerciseId || !validIdSet.has( item.exerciseId ) ) {
            return { error: `Exercise at index ${i} is invalid, archived, or inaccessible` };
        }

        // Validate targetSets (1 to 20, default 3)
        let targetSets = 3;
        if ( item.targetSets !== undefined ) {
            const parsedSets = parseInt( item.targetSets, 10 );
            if ( Number.isNaN( parsedSets ) || parsedSets < 1 || parsedSets > 20 ) {
                return { error: `Target sets at index ${i} must be an integer between 1 and 20` };
            }
            targetSets = parsedSets;
        }

        // Validate targetValue (reps/time range e.g. "8-10", "60s")
        let targetValue = null;
        if ( item.targetValue !== undefined && item.targetValue !== null ) {
            if ( typeof item.targetValue !== "string" ) {
                return { error: `Target value at index ${i} must be a string` };
            }
            targetValue = item.targetValue.trim().slice( 0, 50 );
        }

        // Validate targetWeight
        let targetWeight = null;
        if ( item.targetWeight !== undefined && item.targetWeight !== null ) {
            const parsedWeight = parseFloat( item.targetWeight );
            if ( Number.isNaN( parsedWeight ) || parsedWeight < 0 || parsedWeight > 2000 ) {
                return { error: `Target weight at index ${i} must be a valid positive number` };
            }
            targetWeight = parsedWeight;
        }

        // Validate notes
        let notes = null;
        if ( item.notes !== undefined && item.notes !== null ) {
            if ( typeof item.notes !== "string" ) {
                return { error: `Notes at index ${i} must be a string` };
            }
            notes = item.notes.trim().slice( 0, 500 );
        }

        const orderIndex = Number.isInteger( item.orderIndex ) && item.orderIndex >= 0
            ? item.orderIndex
            : i;

        validatedExercises.push({
            exerciseId: item.exerciseId,
            orderIndex,
            targetSets,
            targetValue,
            targetWeight,
            notes
        });
    }

    return { validatedExercises };
};

// Used to create new workout routine template
export const createRoutine = async ( req, res ) => {
    const { exercises, name, notes, splitTag } = req.body || {};

    // Validate routine name
    if ( !name || typeof name !== "string" ) {
        return sendError( res, "Routine name is required", "ERR_INVALID_NAME", 400 );
    }

    const trimmedName = name.trim().replace( /\s+/g, " " );
    if ( trimmedName.length < 2 || trimmedName.length > 50 ) {
        return sendError( res, "Routine name must be between 2 and 50 characters", "ERR_INVALID_NAME", 400 );
    }

    // Validate split tag if provided
    let cleanedSplitTag = null;
    if ( splitTag !== undefined && splitTag !== null ) {
        if ( typeof splitTag !== "string" ) {
            return sendError( res, "Split tag must be a string", "ERR_INVALID_SPLIT_TAG", 400 );
        }
        cleanedSplitTag = splitTag.trim().slice( 0, 30 ) || null;
    }

    // Validate notes if provided
    let cleanedNotes = null;
    if ( notes !== undefined && notes !== null ) {
        if ( typeof notes !== "string" ) {
            return sendError( res, "Notes must be a string", "ERR_INVALID_NOTES", 400 );
        }
        cleanedNotes = notes.trim().slice( 0, 1000 ) || null;
    }

    // Validate exercises array if provided
    let validatedExercises = [];
    if ( exercises !== undefined ) {
        const validation = await validateRoutineExercises( exercises, req.user.id );
        if ( validation.error ) {
            return sendError( res, validation.error, "ERR_INVALID_EXERCISE", 400 );
        }
        validatedExercises = validation.validatedExercises;
    }

    try {
        const newRoutine = await prisma.$transaction( async ( tx ) => {
            const routine = await tx.workoutRoutine.create({
                data: {
                    userId: req.user.id,
                    name: trimmedName,
                    splitTag: cleanedSplitTag,
                    notes: cleanedNotes,
                    isArchived: false,
                    routineExercises: {
                        create: validatedExercises.map( ( ex ) => ({
                            exerciseId: ex.exerciseId,
                            orderIndex: ex.orderIndex,
                            targetSets: ex.targetSets,
                            targetValue: ex.targetValue,
                            targetWeight: ex.targetWeight,
                            notes: ex.notes
                        }) )
                    }
                },
                include: {
                    routineExercises: {
                        orderBy: { orderIndex: "asc" },
                        include: {
                            exercise: {
                                select: {
                                    id: true,
                                    name: true,
                                    category: true,
                                    equipment: true,
                                    modality: true,
                                    isCustom: true,
                                    isArchived: true
                                }
                            }
                        }
                    }
                }
            });

            return routine;
        });

        return sendSuccess( res, newRoutine, 201 );
    } catch ( err ) {
        console.error( "[Create Routine Error]", err );
        return sendError( res, "Failed to create workout routine", "ERR_CREATE_ROUTINE_FAILED", 500 );
    }
};

// Used to update workout routine template
export const updateRoutine = async ( req, res ) => {
    const { id } = req.params;
    const { exercises, name, notes, splitTag } = req.body || {};

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Workout routine not found", "ERR_ROUTINE_NOT_FOUND", 404 );
    }

    try {
        const existingRoutine = await prisma.workoutRoutine.findFirst({
            where: {
                id,
                userId: req.user.id,
                isArchived: false
            }
        });

        if ( !existingRoutine ) {
            return sendError( res, "Workout routine not found", "ERR_ROUTINE_NOT_FOUND", 404 );
        }

        const updateData = {};

        // Validate and update name if provided
        if ( name !== undefined ) {
            if ( typeof name !== "string" ) {
                return sendError( res, "Routine name must be a string", "ERR_INVALID_NAME", 400 );
            }
            const trimmedName = name.trim().replace( /\s+/g, " " );
            if ( trimmedName.length < 2 || trimmedName.length > 50 ) {
                return sendError( res, "Routine name must be between 2 and 50 characters", "ERR_INVALID_NAME", 400 );
            }
            updateData.name = trimmedName;
        }

        // Validate and update split tag if provided
        if ( splitTag !== undefined ) {
            if ( splitTag === null ) {
                updateData.splitTag = null;
            } else if ( typeof splitTag !== "string" ) {
                return sendError( res, "Split tag must be a string", "ERR_INVALID_SPLIT_TAG", 400 );
            } else {
                updateData.splitTag = splitTag.trim().slice( 0, 30 ) || null;
            }
        }

        // Validate and update notes if provided
        if ( notes !== undefined ) {
            if ( notes === null ) {
                updateData.notes = null;
            } else if ( typeof notes !== "string" ) {
                return sendError( res, "Notes must be a string", "ERR_INVALID_NOTES", 400 );
            } else {
                updateData.notes = notes.trim().slice( 0, 1000 ) || null;
            }
        }

        // Validate exercises array if provided
        let validatedExercises = null;
        if ( exercises !== undefined ) {
            const validation = await validateRoutineExercises( exercises, req.user.id );
            if ( validation.error ) {
                return sendError( res, validation.error, "ERR_INVALID_EXERCISE", 400 );
            }
            validatedExercises = validation.validatedExercises;
        }

        if ( Object.keys( updateData ).length === 0 && validatedExercises === null ) {
            return sendError( res, "No valid routine fields provided for update", "ERR_NO_UPDATES", 400 );
        }

        const updatedRoutine = await prisma.$transaction( async ( tx ) => {
            // Re-populate exercises if provided in payload
            if ( validatedExercises !== null ) {
                await tx.routineExercise.deleteMany({
                    where: { routineId: id }
                });

                if ( validatedExercises.length > 0 ) {
                    await tx.routineExercise.createMany({
                        data: validatedExercises.map( ( ex ) => ({
                            routineId: id,
                            exerciseId: ex.exerciseId,
                            orderIndex: ex.orderIndex,
                            targetSets: ex.targetSets,
                            targetValue: ex.targetValue,
                            targetWeight: ex.targetWeight,
                            notes: ex.notes
                        }) )
                    });
                }
            }

            const routine = await tx.workoutRoutine.update({
                where: { id },
                data: updateData,
                include: {
                    routineExercises: {
                        orderBy: { orderIndex: "asc" },
                        include: {
                            exercise: {
                                select: {
                                    id: true,
                                    name: true,
                                    category: true,
                                    equipment: true,
                                    modality: true,
                                    isCustom: true,
                                    isArchived: true
                                }
                            }
                        }
                    }
                }
            });

            return routine;
        });

        return sendSuccess( res, updatedRoutine );
    } catch ( err ) {
        console.error( "[Update Routine Error]", err );
        return sendError( res, "Failed to update workout routine", "ERR_UPDATE_ROUTINE_FAILED", 500 );
    }
};

// Used to duplicate existing workout routine into new template
export const copyRoutine = async ( req, res ) => {
    const { id } = req.params;
    const { name } = req.body || {};

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Workout routine not found", "ERR_ROUTINE_NOT_FOUND", 404 );
    }

    try {
        const originalRoutine = await prisma.workoutRoutine.findFirst({
            where: {
                id,
                userId: req.user.id,
                isArchived: false
            },
            include: {
                routineExercises: {
                    orderBy: { orderIndex: "asc" }
                }
            }
        });

        if ( !originalRoutine ) {
            return sendError( res, "Workout routine not found", "ERR_ROUTINE_NOT_FOUND", 404 );
        }

        // Determine copy routine name
        let copyName = `${originalRoutine.name} (Copy)`.slice( 0, 50 );
        if ( name && typeof name === "string" && name.trim() !== "" ) {
            copyName = name.trim().replace( /\s+/g, " " ).slice( 0, 50 );
        }

        const duplicatedRoutine = await prisma.$transaction( async ( tx ) => {
            const newRoutine = await tx.workoutRoutine.create({
                data: {
                    userId: req.user.id,
                    name: copyName,
                    splitTag: originalRoutine.splitTag,
                    notes: originalRoutine.notes,
                    isArchived: false,
                    routineExercises: {
                        create: originalRoutine.routineExercises.map( ( ex ) => ({
                            exerciseId: ex.exerciseId,
                            orderIndex: ex.orderIndex,
                            targetSets: ex.targetSets,
                            targetValue: ex.targetValue,
                            targetWeight: ex.targetWeight,
                            notes: ex.notes
                        }) )
                    }
                },
                include: {
                    routineExercises: {
                        orderBy: { orderIndex: "asc" },
                        include: {
                            exercise: {
                                select: {
                                    id: true,
                                    name: true,
                                    category: true,
                                    equipment: true,
                                    modality: true,
                                    isCustom: true,
                                    isArchived: true
                                }
                            }
                        }
                    }
                }
            });

            return newRoutine;
        });

        return sendSuccess( res, duplicatedRoutine, 201 );
    } catch ( err ) {
        console.error( "[Copy Routine Error]", err );
        return sendError( res, "Failed to copy workout routine", "ERR_COPY_ROUTINE_FAILED", 500 );
    }
};

// Used to soft-delete (archive) workout routine template
export const deleteRoutine = async ( req, res ) => {
    const { id } = req.params;

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Workout routine not found", "ERR_ROUTINE_NOT_FOUND", 404 );
    }

    try {
        const routine = await prisma.workoutRoutine.findFirst({
            where: {
                id,
                userId: req.user.id,
                isArchived: false
            }
        });

        if ( !routine ) {
            return sendError( res, "Workout routine not found", "ERR_ROUTINE_NOT_FOUND", 404 );
        }

        // Soft-delete to preserve foreign key links on historical workout entries
        await prisma.workoutRoutine.update({
            where: { id },
            data: { isArchived: true }
        });

        return sendSuccess( res, {
            message: "Workout routine archived successfully",
            id
        });
    } catch ( err ) {
        console.error( "[Delete Routine Error]", err );
        return sendError( res, "Failed to delete workout routine", "ERR_DELETE_ROUTINE_FAILED", 500 );
    }
};

