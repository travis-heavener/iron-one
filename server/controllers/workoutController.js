/******************************************************************************
 * Workout Controller
 * Handles workout session logs, active session lifecycle, and calendar views
 ******************************************************************************/

import prisma from "../models/db.js";
import { sendError, sendSuccess } from "../utils/response.js";

// Used to fetch currently active in-progress workout session
export const getActiveWorkout = async ( req, res ) => {
    try {
        const activeWorkout = await prisma.workoutEntry.findFirst({
            where: {
                userId: req.user.id,
                status: "IN_PROGRESS"
            },
            include: {
                routine: {
                    select: {
                        id: true,
                        name: true,
                        splitTag: true
                    }
                },
                workoutExercises: {
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
                        },
                        sets: {
                            orderBy: { setNumber: "asc" }
                        }
                    }
                }
            }
        });

        return sendSuccess( res, activeWorkout );
    } catch ( err ) {
        console.error( "[Get Active Workout Error]", err );
        return sendError( res, "Failed to retrieve active workout session", "ERR_FETCH_ACTIVE_WORKOUT_FAILED", 500 );
    }
};

// Used to start spontaneous ad-hoc workout session from scratch
export const createWorkoutEntry = async ( req, res ) => {
    const { date, name, notes, splitTag } = req.body || {};

    // Enforce Single Active Workout Rule
    const existingActive = await prisma.workoutEntry.findFirst({
        where: {
            userId: req.user.id,
            status: "IN_PROGRESS"
        },
        select: { id: true, name: true, startedAt: true }
    });

    if ( existingActive ) {
        return sendError(
            res,
            "An active workout is already in progress. Complete or finish it before starting a new one.",
            "ERR_ACTIVE_WORKOUT_EXISTS",
            409,
            { activeWorkoutId: existingActive.id, activeWorkout: existingActive }
        );
    }

    // Determine workout title
    let workoutName = "Quick Workout";
    if ( name && typeof name === "string" && name.trim() !== "" ) {
        workoutName = name.trim().replace( /\s+/g, " " ).slice( 0, 50 );
    }

    // Clean optional fields
    const cleanedSplitTag = typeof splitTag === "string" ? splitTag.trim().slice( 0, 30 ) || null : null;
    const cleanedNotes = typeof notes === "string" ? notes.trim().slice( 0, 1000 ) || null : null;

    let workoutDate = new Date();
    if ( date ) {
        const parsedDate = new Date( date );
        if ( !Number.isNaN( parsedDate.getTime() ) ) {
            workoutDate = parsedDate;
        }
    }

    try {
        const entry = await prisma.workoutEntry.create({
            data: {
                userId: req.user.id,
                name: workoutName,
                splitTag: cleanedSplitTag,
                notes: cleanedNotes,
                status: "IN_PROGRESS",
                date: workoutDate,
                startedAt: new Date()
            },
            include: {
                workoutExercises: {
                    include: {
                        exercise: true,
                        sets: true
                    }
                }
            }
        });

        return sendSuccess( res, entry, 201 );
    } catch ( err ) {
        console.error( "[Create Workout Entry Error]", err );
        return sendError( res, "Failed to start workout session", "ERR_CREATE_WORKOUT_FAILED", 500 );
    }
};

// Used to start active workout session instantiated from routine template
export const startRoutineWorkout = async ( req, res ) => {
    const { id } = req.params;

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Workout routine not found", "ERR_ROUTINE_NOT_FOUND", 404 );
    }

    // Enforce Single Active Workout Rule
    const existingActive = await prisma.workoutEntry.findFirst({
        where: {
            userId: req.user.id,
            status: "IN_PROGRESS"
        },
        select: { id: true, name: true, startedAt: true }
    });

    if ( existingActive ) {
        return sendError(
            res,
            "An active workout is already in progress. Complete or finish it before starting a new one.",
            "ERR_ACTIVE_WORKOUT_EXISTS",
            409,
            { activeWorkoutId: existingActive.id, activeWorkout: existingActive }
        );
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
                        exercise: true
                    }
                }
            }
        });

        if ( !routine ) {
            return sendError( res, "Workout routine not found", "ERR_ROUTINE_NOT_FOUND", 404 );
        }

        const now = new Date();

        const newEntry = await prisma.$transaction( async ( tx ) => {
            const entry = await tx.workoutEntry.create({
                data: {
                    userId: req.user.id,
                    routineId: routine.id,
                    name: routine.name,
                    splitTag: routine.splitTag,
                    notes: routine.notes,
                    status: "IN_PROGRESS",
                    date: now,
                    startedAt: now
                }
            });

            // Populate session exercises and baseline uncompleted sets from routine targets
            for ( let i = 0; i < routine.routineExercises.length; ++i ) {
                const re = routine.routineExercises[i];

                const workoutExercise = await tx.workoutExercise.create({
                    data: {
                        workoutEntryId: entry.id,
                        exerciseId: re.exerciseId,
                        orderIndex: re.orderIndex,
                        notes: re.notes
                    }
                });

                // Parse target reps or duration from targetValue string if available
                let parsedReps = null;
                let parsedDuration = null;

                if ( re.targetValue ) {
                    const parsedInt = parseInt( re.targetValue, 10 );
                    if ( !Number.isNaN( parsedInt ) && parsedInt > 0 ) {
                        if ( re.exercise.modality === "TIME_DURATION" ) {
                            parsedDuration = parsedInt;
                        } else if ( re.exercise.modality === "WEIGHT_REPS" ) {
                            parsedReps = parsedInt;
                        }
                    }
                }

                const targetSetsCount = Math.max( 1, Math.min( re.targetSets || 3, 20 ) );
                const setsData = [];

                for ( let s = 0; s < targetSetsCount; ++s ) {
                    setsData.push({
                        workoutExerciseId: workoutExercise.id,
                        setNumber: s + 1,
                        setType: "NORMAL",
                        weight: re.targetWeight || null,
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

            return await tx.workoutEntry.findUnique({
                where: { id: entry.id },
                include: {
                    routine: {
                        select: { id: true, name: true, splitTag: true }
                    },
                    workoutExercises: {
                        orderBy: { orderIndex: "asc" },
                        include: {
                            exercise: true,
                            sets: {
                                orderBy: { setNumber: "asc" }
                            }
                        }
                    }
                }
            });
        });

        return sendSuccess( res, newEntry, 201 );
    } catch ( err ) {
        console.error( "[Start Routine Workout Error]", err );
        return sendError( res, "Failed to start workout from routine", "ERR_START_ROUTINE_FAILED", 500 );
    }
};

// Used to retrieve chronological paginated journal feed of workouts
export const getWorkoutEntries = async ( req, res ) => {
    const { endDate, limit, offset, routineId, startDate, status } = req.query;

    const where = {
        userId: req.user.id
    };

    // Filter by status if provided
    if ( status && ( status === "IN_PROGRESS" || status === "COMPLETED" ) ) {
        where.status = status;
    }

    // Filter by routineId if provided
    if ( routineId && typeof routineId === "string" ) {
        where.routineId = routineId;
    }

    // Filter by date range if provided
    if ( startDate || endDate ) {
        where.date = {};
        if ( startDate ) {
            const start = new Date( startDate );
            if ( !Number.isNaN( start.getTime() ) ) {
                where.date.gte = start;
            }
        }
        if ( endDate ) {
            const end = new Date( endDate );
            if ( !Number.isNaN( end.getTime() ) ) {
                where.date.lte = end;
            }
        }
    }

    const parsedLimit = limit !== undefined ? Math.min( Math.max( parseInt( limit, 10 ) || 20, 1 ), 100 ) : 20;
    const parsedOffset = offset !== undefined ? Math.max( parseInt( offset, 10 ) || 0, 0 ) : 0;

    try {
        const [ entries, totalCount ] = await Promise.all([
            prisma.workoutEntry.findMany({
                where,
                orderBy: [
                    { date: "desc" },
                    { createdAt: "desc" }
                ],
                take: parsedLimit,
                skip: parsedOffset,
                include: {
                    routine: {
                        select: { id: true, name: true, splitTag: true }
                    },
                    workoutExercises: {
                        orderBy: { orderIndex: "asc" },
                        include: {
                            exercise: {
                                select: {
                                    id: true,
                                    name: true,
                                    category: true,
                                    equipment: true,
                                    modality: true
                                }
                            },
                            sets: {
                                orderBy: { setNumber: "asc" }
                            }
                        }
                    }
                }
            }),
            prisma.workoutEntry.count({ where })
        ]);

        return sendSuccess( res, {
            entries,
            pagination: {
                totalCount,
                limit: parsedLimit,
                offset: parsedOffset,
                hasMore: parsedOffset + entries.length < totalCount
            }
        });
    } catch ( err ) {
        console.error( "[Get Workout Entries Error]", err );
        return sendError( res, "Failed to retrieve workout entries", "ERR_FETCH_ENTRIES_FAILED", 500 );
    }
};

// Used to aggregate daily workout badges for calendar view
export const getCalendarWorkouts = async ( req, res ) => {
    const { month, year } = req.query;

    const where = {
        userId: req.user.id
    };

    // Filter by year/month if provided (e.g. year=2026, month=10)
    if ( year ) {
        const y = parseInt( year, 10 );
        if ( !Number.isNaN( y ) && y >= 2000 && y <= 2100 ) {
            let startMonth = 0;
            let endMonth = 11;

            if ( month ) {
                const m = parseInt( month, 10 ) - 1; // 0-indexed month
                if ( !Number.isNaN( m ) && m >= 0 && m <= 11 ) {
                    startMonth = endMonth = m;
                }
            }

            const startDate = new Date( Date.UTC( y, startMonth, 1, 0, 0, 0 ) );
            const endDate = new Date( Date.UTC( y, endMonth + 1, 0, 23, 59, 59, 999 ) );

            where.date = {
                gte: startDate,
                lte: endDate
            };
        }
    }

    try {
        const entries = await prisma.workoutEntry.findMany({
            where,
            orderBy: { date: "asc" },
            select: {
                id: true,
                name: true,
                splitTag: true,
                status: true,
                date: true,
                durationMinutes: true
            }
        });

        // Group entries by date string YYYY-MM-DD
        const calendarMap = {};
        for ( let i = 0; i < entries.length; ++i ) {
            const entry = entries[i];
            const dateStr = entry.date.toISOString().split( "T" )[0];

            if ( !calendarMap[dateStr] ) {
                calendarMap[dateStr] = [];
            }

            calendarMap[dateStr].push({
                id: entry.id,
                name: entry.name,
                splitTag: entry.splitTag,
                status: entry.status,
                durationMinutes: entry.durationMinutes
            });
        }

        return sendSuccess( res, calendarMap );
    } catch ( err ) {
        console.error( "[Get Calendar Workouts Error]", err );
        return sendError( res, "Failed to retrieve calendar workout data", "ERR_FETCH_CALENDAR_FAILED", 500 );
    }
};

// Used to retrieve full workout entry details by ID
export const getWorkoutEntryById = async ( req, res ) => {
    const { id } = req.params;

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Workout entry not found", "ERR_ENTRY_NOT_FOUND", 404 );
    }

    try {
        const entry = await prisma.workoutEntry.findFirst({
            where: {
                id,
                userId: req.user.id
            },
            include: {
                routine: {
                    select: { id: true, name: true, splitTag: true }
                },
                workoutExercises: {
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
                        },
                        sets: {
                            orderBy: { setNumber: "asc" }
                        }
                    }
                }
            }
        });

        if ( !entry ) {
            return sendError( res, "Workout entry not found", "ERR_ENTRY_NOT_FOUND", 404 );
        }

        return sendSuccess( res, entry );
    } catch ( err ) {
        console.error( "[Get Workout Entry Error]", err );
        return sendError( res, "Failed to retrieve workout entry", "ERR_FETCH_ENTRY_FAILED", 500 );
    }
};

// Used to update workout entry metadata (name, splitTag, notes, date)
export const updateWorkoutEntry = async ( req, res ) => {
    const { id } = req.params;
    const { date, durationMinutes, name, notes, splitTag } = req.body || {};

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Workout entry not found", "ERR_ENTRY_NOT_FOUND", 404 );
    }

    try {
        const existingEntry = await prisma.workoutEntry.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });

        if ( !existingEntry ) {
            return sendError( res, "Workout entry not found", "ERR_ENTRY_NOT_FOUND", 404 );
        }

        const updateData = {};

        // Validate and update name
        if ( name !== undefined ) {
            if ( typeof name !== "string" ) {
                return sendError( res, "Workout name must be a string", "ERR_INVALID_NAME", 400 );
            }
            const trimmedName = name.trim().replace( /\s+/g, " " );
            if ( trimmedName.length < 2 || trimmedName.length > 50 ) {
                return sendError( res, "Workout name must be between 2 and 50 characters", "ERR_INVALID_NAME", 400 );
            }
            updateData.name = trimmedName;
        }

        // Validate and update split tag
        if ( splitTag !== undefined ) {
            if ( splitTag === null ) {
                updateData.splitTag = null;
            } else if ( typeof splitTag !== "string" ) {
                return sendError( res, "Split tag must be a string", "ERR_INVALID_SPLIT_TAG", 400 );
            } else {
                updateData.splitTag = splitTag.trim().slice( 0, 30 ) || null;
            }
        }

        // Validate and update notes
        if ( notes !== undefined ) {
            if ( notes === null ) {
                updateData.notes = null;
            } else if ( typeof notes !== "string" ) {
                return sendError( res, "Notes must be a string", "ERR_INVALID_NOTES", 400 );
            } else {
                updateData.notes = notes.trim().slice( 0, 1000 ) || null;
            }
        }

        // Validate and update date
        if ( date !== undefined ) {
            const parsedDate = new Date( date );
            if ( Number.isNaN( parsedDate.getTime() ) ) {
                return sendError( res, "Invalid date format", "ERR_INVALID_DATE", 400 );
            }
            updateData.date = parsedDate;
        }

        // Validate and update duration
        if ( durationMinutes !== undefined ) {
            if ( durationMinutes === null ) {
                updateData.durationMinutes = null;
            } else {
                const parsedDuration = parseInt( durationMinutes, 10 );
                if ( Number.isNaN( parsedDuration ) || parsedDuration < 0 || parsedDuration > 1440 ) {
                    return sendError( res, "Duration minutes must be a positive integer <= 1440", "ERR_INVALID_DURATION", 400 );
                }
                updateData.durationMinutes = parsedDuration;
            }
        }

        if ( Object.keys( updateData ).length === 0 ) {
            return sendError( res, "No valid fields provided for update", "ERR_NO_UPDATES", 400 );
        }

        const updated = await prisma.workoutEntry.update({
            where: { id },
            data: updateData
        });

        return sendSuccess( res, updated );
    } catch ( err ) {
        console.error( "[Update Workout Entry Error]", err );
        return sendError( res, "Failed to update workout entry", "ERR_UPDATE_ENTRY_FAILED", 500 );
    }
};

// Used to finish active workout session and calculate elapsed duration
export const completeWorkoutEntry = async ( req, res ) => {
    const { id } = req.params;
    const { completedAt, durationMinutes } = req.body || {};

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Workout entry not found", "ERR_ENTRY_NOT_FOUND", 404 );
    }

    try {
        const entry = await prisma.workoutEntry.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });

        if ( !entry ) {
            return sendError( res, "Workout entry not found", "ERR_ENTRY_NOT_FOUND", 404 );
        }

        if ( entry.status === "COMPLETED" ) {
            return sendError( res, "Workout session is already completed", "ERR_ALREADY_COMPLETED", 400 );
        }

        const completionTimestamp = completedAt ? new Date( completedAt ) : new Date();
        const validCompletedAt = !Number.isNaN( completionTimestamp.getTime() ) ? completionTimestamp : new Date();

        // Calculate duration in minutes if not explicitly provided
        let finalDuration = null;
        if ( durationMinutes !== undefined && durationMinutes !== null ) {
            const parsedDuration = parseInt( durationMinutes, 10 );
            if ( !Number.isNaN( parsedDuration ) && parsedDuration >= 0 ) {
                finalDuration = Math.min( parsedDuration, 1440 );
            }
        } else if ( entry.startedAt ) {
            const diffMs = validCompletedAt.getTime() - new Date( entry.startedAt ).getTime();
            finalDuration = Math.max( 1, Math.round( diffMs / ( 1000 * 60 ) ) );
        }

        const completedEntry = await prisma.workoutEntry.update({
            where: { id },
            data: {
                status: "COMPLETED",
                completedAt: validCompletedAt,
                durationMinutes: finalDuration
            },
            include: {
                workoutExercises: {
                    orderBy: { orderIndex: "asc" },
                    include: {
                        exercise: true,
                        sets: {
                            orderBy: { setNumber: "asc" }
                        }
                    }
                }
            }
        });

        return sendSuccess( res, completedEntry );
    } catch ( err ) {
        console.error( "[Complete Workout Entry Error]", err );
        return sendError( res, "Failed to complete workout session", "ERR_COMPLETE_ENTRY_FAILED", 500 );
    }
};

// Used to clone past workout into new active session for progressive overload
export const cloneWorkoutEntry = async ( req, res ) => {
    const { id } = req.params;

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Workout entry not found", "ERR_ENTRY_NOT_FOUND", 404 );
    }

    // Enforce Single Active Workout Rule
    const existingActive = await prisma.workoutEntry.findFirst({
        where: {
            userId: req.user.id,
            status: "IN_PROGRESS"
        },
        select: { id: true, name: true, startedAt: true }
    });

    if ( existingActive ) {
        return sendError(
            res,
            "An active workout is already in progress. Complete or finish it before cloning another session.",
            "ERR_ACTIVE_WORKOUT_EXISTS",
            409,
            { activeWorkoutId: existingActive.id, activeWorkout: existingActive }
        );
    }

    try {
        const sourceEntry = await prisma.workoutEntry.findFirst({
            where: {
                id,
                userId: req.user.id
            },
            include: {
                workoutExercises: {
                    orderBy: { orderIndex: "asc" },
                    include: {
                        sets: {
                            orderBy: { setNumber: "asc" }
                        }
                    }
                }
            }
        });

        if ( !sourceEntry ) {
            return sendError( res, "Workout entry not found", "ERR_ENTRY_NOT_FOUND", 404 );
        }

        const now = new Date();

        const clonedEntry = await prisma.$transaction( async ( tx ) => {
            const newEntry = await tx.workoutEntry.create({
                data: {
                    userId: req.user.id,
                    routineId: sourceEntry.routineId,
                    name: sourceEntry.name,
                    splitTag: sourceEntry.splitTag,
                    notes: sourceEntry.notes,
                    status: "IN_PROGRESS",
                    date: now,
                    startedAt: now
                }
            });

            // Carry over past exercises and sets as uncompleted progressive overload targets
            for ( let i = 0; i < sourceEntry.workoutExercises.length; ++i ) {
                const we = sourceEntry.workoutExercises[i];

                const newWorkoutExercise = await tx.workoutExercise.create({
                    data: {
                        workoutEntryId: newEntry.id,
                        exerciseId: we.exerciseId,
                        orderIndex: we.orderIndex,
                        notes: we.notes
                    }
                });

                if ( we.sets.length > 0 ) {
                    await tx.exerciseSet.createMany({
                        data: we.sets.map( ( s ) => ({
                            workoutExerciseId: newWorkoutExercise.id,
                            setNumber: s.setNumber,
                            setType: s.setType,
                            weight: s.weight,
                            reps: s.reps,
                            durationSeconds: s.durationSeconds,
                            distance: s.distance,
                            distanceUnit: s.distanceUnit,
                            rpe: null,
                            isCompleted: false, // Target baseline ready to be checked off
                            meta: s.meta
                        }) )
                    });
                }
            }

            return await tx.workoutEntry.findUnique({
                where: { id: newEntry.id },
                include: {
                    workoutExercises: {
                        orderBy: { orderIndex: "asc" },
                        include: {
                            exercise: true,
                            sets: {
                                orderBy: { setNumber: "asc" }
                            }
                        }
                    }
                }
            });
        });

        return sendSuccess( res, clonedEntry, 201 );
    } catch ( err ) {
        console.error( "[Clone Workout Entry Error]", err );
        return sendError( res, "Failed to clone workout session", "ERR_CLONE_ENTRY_FAILED", 500 );
    }
};

// Used to delete workout entry and cascade delete its exercises and sets
export const deleteWorkoutEntry = async ( req, res ) => {
    const { id } = req.params;

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Workout entry not found", "ERR_ENTRY_NOT_FOUND", 404 );
    }

    try {
        const entry = await prisma.workoutEntry.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });

        if ( !entry ) {
            return sendError( res, "Workout entry not found", "ERR_ENTRY_NOT_FOUND", 404 );
        }

        await prisma.workoutEntry.delete({
            where: { id }
        });

        return sendSuccess( res, {
            message: "Workout entry deleted successfully",
            id
        });
    } catch ( err ) {
        console.error( "[Delete Workout Entry Error]", err );
        return sendError( res, "Failed to delete workout entry", "ERR_DELETE_ENTRY_FAILED", 500 );
    }
};

