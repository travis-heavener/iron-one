/******************************************************************************
 * Workout Controller
 * Handles workout session logs, active session lifecycle, and calendar views
 ******************************************************************************/

import prisma from "../models/db.js";
import { sendError, sendSuccess } from "../utils/response.js";

// Standard Prisma include structure for full workout entry responses
const WORKOUT_ENTRY_INCLUDE = {
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
};

// Used to fetch currently active in-progress workout session
export const getActiveWorkout = async ( req, res ) => {
    try {
        const activeWorkout = await prisma.workoutEntry.findFirst({
            where: {
                userId: req.user.id,
                status: "IN_PROGRESS"
            },
            include: WORKOUT_ENTRY_INCLUDE
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
        const entry = await prisma.$transaction( async ( tx ) => {
            // Enforce Single Active Workout Rule inside write transaction
            const existingActive = await tx.workoutEntry.findFirst({
                where: {
                    userId: req.user.id,
                    status: "IN_PROGRESS"
                },
                select: { id: true, name: true, startedAt: true }
            });

            if ( existingActive ) {
                const conflictErr = new Error( "An active workout is already in progress. Complete or finish it before starting a new one." );
                conflictErr.code = "ERR_ACTIVE_WORKOUT_EXISTS";
                conflictErr.status = 409;
                conflictErr.details = { activeWorkoutId: existingActive.id, activeWorkout: existingActive };
                throw conflictErr;
            }

            return await tx.workoutEntry.create({
                data: {
                    userId: req.user.id,
                    name: workoutName,
                    splitTag: cleanedSplitTag,
                    notes: cleanedNotes,
                    status: "IN_PROGRESS",
                    date: workoutDate,
                    startedAt: new Date()
                },
                include: WORKOUT_ENTRY_INCLUDE
            });
        });

        return sendSuccess( res, entry, 201 );
    } catch ( err ) {
        if ( err.code === "ERR_ACTIVE_WORKOUT_EXISTS" ) {
            return sendError( res, err.message, err.code, err.status || 409, err.details );
        }

        console.error( "[Create Workout Entry Error]", err );
        return sendError( res, "Failed to start workout session", "ERR_CREATE_WORKOUT_FAILED", 500 );
    }
};

// Used to start active workout session instantiated from routine template
export const startRoutineWorkout = async ( req, res ) => {
    const { id } = req.params;
    const { date } = req.body || {};

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
                        exercise: true
                    }
                }
            }
        });

        if ( !routine ) {
            return sendError( res, "Workout routine not found", "ERR_ROUTINE_NOT_FOUND", 404 );
        }

        const now = new Date();
        let workoutDate = now;
        if ( date ) {
            const parsedDate = new Date( date );
            if ( !Number.isNaN( parsedDate.getTime() ) ) {
                workoutDate = parsedDate;
            }
        }

        const newEntry = await prisma.$transaction( async ( tx ) => {
            // Enforce Single Active Workout Rule inside write transaction
            const existingActive = await tx.workoutEntry.findFirst({
                where: {
                    userId: req.user.id,
                    status: "IN_PROGRESS"
                },
                select: { id: true, name: true, startedAt: true }
            });

            if ( existingActive ) {
                const conflictErr = new Error( "An active workout is already in progress. Complete or finish it before starting a new one." );
                conflictErr.code = "ERR_ACTIVE_WORKOUT_EXISTS";
                conflictErr.status = 409;
                conflictErr.details = { activeWorkoutId: existingActive.id, activeWorkout: existingActive };
                throw conflictErr;
            }

            const entry = await tx.workoutEntry.create({
                data: {
                    userId: req.user.id,
                    routineId: routine.id,
                    name: routine.name,
                    splitTag: routine.splitTag,
                    notes: routine.notes,
                    status: "IN_PROGRESS",
                    date: workoutDate,
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

                // Parse target reps, duration, or distance from targetValue string if available
                let parsedReps = null;
                let parsedDuration = null;
                let parsedDistance = null;
                let parsedDistanceUnit = null;

                if ( re.targetValue ) {
                    const trimmed = String( re.targetValue ).trim();
                    const parsedNum = parseFloat( trimmed );

                    if ( !Number.isNaN( parsedNum ) && parsedNum > 0 ) {
                        if ( re.exercise.modality === "TIME_DURATION" ) {
                            // If minutes are specified (e.g. "30m" or "30 min"), convert to seconds
                            if ( /m(?:in)?/i.test( trimmed ) && !/s(?:ec)?/i.test( trimmed ) ) {
                                parsedDuration = Math.round( parsedNum * 60 );
                            } else {
                                parsedDuration = Math.round( parsedNum );
                            }
                        } else if ( re.exercise.modality === "WEIGHT_REPS" ) {
                            parsedReps = Math.round( parsedNum );
                        } else if ( re.exercise.modality === "DISTANCE_TIME" ) {
                            // If string explicitly specifies time duration (e.g. "30 min")
                            if ( /m(?:in)?/i.test( trimmed ) && !/mi/i.test( trimmed ) ) {
                                parsedDuration = Math.round( parsedNum * 60 );
                            } else {
                                parsedDistance = parsedNum;
                                if ( /km/i.test( trimmed ) ) {
                                    parsedDistanceUnit = "km";
                                } else if ( /mi/i.test( trimmed ) ) {
                                    parsedDistanceUnit = "mi";
                                } else if ( /m\b/i.test( trimmed ) ) {
                                    parsedDistanceUnit = "m";
                                } else {
                                    parsedDistanceUnit = "mi";
                                }
                            }
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
                        distance: parsedDistance,
                        distanceUnit: parsedDistanceUnit,
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
                include: WORKOUT_ENTRY_INCLUDE
            });
        });

        return sendSuccess( res, newEntry, 201 );
    } catch ( err ) {
        if ( err.code === "ERR_ACTIVE_WORKOUT_EXISTS" ) {
            return sendError( res, err.message, err.code, err.status || 409, err.details );
        }

        console.error( "[Start Routine Workout Error]", err );
        return sendError( res, "Failed to start workout from routine", "ERR_START_ROUTINE_FAILED", 500 );
    }
};

// Used to retrieve chronological paginated journal feed of workouts
export const getWorkoutEntries = async ( req, res ) => {
    const { endDate, limit, offset, routineId, search, splitTag, startDate, status, timezoneOffset } = req.query;

    const where = {
        userId: req.user.id
    };

    // Filter by status if provided
    if ( status && ( status === "IN_PROGRESS" || status === "COMPLETED" || status === "CANCELED" ) ) {
        where.status = status;
    }

    // Filter by routineId if provided
    if ( routineId && typeof routineId === "string" ) {
        where.routineId = routineId;
    }

    // Filter by splitTag if provided
    if ( splitTag && typeof splitTag === "string" && splitTag.trim() !== "" ) {
        where.splitTag = splitTag.trim();
    }

    // Filter by name search substring if provided
    if ( search && typeof search === "string" && search.trim() !== "" ) {
        where.name = {
            contains: search.trim().slice( 0, 100 )
        };
    }

    // Filter by date range if provided w/ optional timezone offset adjustment
    if ( startDate || endDate ) {
        const parsedOffsetMin = parseInt( timezoneOffset, 10 );
        const offsetMs = !Number.isNaN( parsedOffsetMin ) ? parsedOffsetMin * 60 * 1000 : 0;

        where.date = {};
        if ( startDate ) {
            if ( typeof startDate === "string" && !startDate.includes( "T" ) ) {
                const start = new Date( new Date( `${startDate}T00:00:00.000Z` ).getTime() + offsetMs );
                if ( !Number.isNaN( start.getTime() ) ) {
                    where.date.gte = start;
                }
            } else {
                const start = new Date( startDate );
                if ( !Number.isNaN( start.getTime() ) ) {
                    where.date.gte = start;
                }
            }
        }
        if ( endDate ) {
            if ( typeof endDate === "string" && !endDate.includes( "T" ) ) {
                const end = new Date( new Date( `${endDate}T23:59:59.999Z` ).getTime() + offsetMs );
                if ( !Number.isNaN( end.getTime() ) ) {
                    where.date.lte = end;
                }
            } else {
                const end = new Date( endDate );
                if ( !Number.isNaN( end.getTime() ) ) {
                    where.date.lte = end;
                }
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
                include: WORKOUT_ENTRY_INCLUDE
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
    const { endDate: qEndDate, month, startDate: qStartDate, timezoneOffset, year } = req.query;

    const where = {
        userId: req.user.id
    };

    // Filter by explicit date range or year/month if provided
    if ( qStartDate || qEndDate ) {
        where.date = {};
        if ( qStartDate ) {
            const start = new Date( qStartDate );
            if ( !Number.isNaN( start.getTime() ) ) {
                where.date.gte = start;
            }
        }
        if ( qEndDate ) {
            let end = new Date( qEndDate );
            if ( !Number.isNaN( end.getTime() ) ) {
                if ( typeof qEndDate === "string" && !qEndDate.includes( "T" ) ) {
                    end = new Date( `${qEndDate}T23:59:59.999Z` );
                }
                where.date.lte = end;
            }
        }
    } else if ( year ) {
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

            // Pad window by 24h to avoid clipping boundary workouts in non-UTC timezones
            const startDate = new Date( Date.UTC( y, startMonth, 1, 0, 0, 0 ) - ( 24 * 60 * 60 * 1000 ) );
            const endDate = new Date( Date.UTC( y, endMonth + 1, 0, 23, 59, 59, 999 ) + ( 24 * 60 * 60 * 1000 ) );

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
                durationMinutes: true,
                _count: {
                    select: {
                        workoutExercises: true
                    }
                }
            }
        });

        // Group entries by date string YYYY-MM-DD adjusted for client timezone if provided
        const parsedOffsetMin = parseInt( timezoneOffset, 10 );
        const offsetMs = !Number.isNaN( parsedOffsetMin ) ? parsedOffsetMin * 60 * 1000 : 0;

        const calendarMap = {};
        for ( let i = 0; i < entries.length; ++i ) {
            const entry = entries[i];
            const localTime = new Date( entry.date.getTime() - offsetMs );
            const dateStr = localTime.toISOString().split( "T" )[0];

            if ( !calendarMap[dateStr] ) {
                calendarMap[dateStr] = [];
            }

            calendarMap[dateStr].push({
                id: entry.id,
                name: entry.name,
                splitTag: entry.splitTag,
                status: entry.status,
                date: entry.date,
                durationMinutes: entry.durationMinutes,
                exerciseCount: entry._count?.workoutExercises ?? 0
            });
        }

        return sendSuccess( res, calendarMap );
    } catch ( err ) {
        console.error( "[Get Calendar Workouts Error]", err );
        return sendError( res, "Failed to retrieve calendar workout data", "ERR_FETCH_CALENDAR_FAILED", 500 );
    }
};

// Used to calculate weekly consistency streak and current week day log
export const getWorkoutStreak = async ( req, res ) => {
    const { timezoneOffset } = req.query;

    const parsedOffsetMin = parseInt( timezoneOffset, 10 );
    const offsetMs = !Number.isNaN( parsedOffsetMin ) ? parsedOffsetMin * 60 * 1000 : 0;

    try {
        const entries = await prisma.workoutEntry.findMany({
            where: {
                userId: req.user.id,
                status: { not: "CANCELED" }
            },
            select: {
                id: true,
                date: true,
                status: true
            },
            orderBy: { date: "desc" }
        });

        // Determine current local time and current week's Sunday 12:00 AM
        const nowLocal = new Date( Date.now() - offsetMs );
        const currentSundayLocal = new Date( nowLocal );
        currentSundayLocal.setUTCHours( 0, 0, 0, 0 );
        currentSundayLocal.setUTCDate( currentSundayLocal.getUTCDate() - currentSundayLocal.getUTCDay() );
        const currentDayOfWeek = nowLocal.getUTCDay(); // 0 is Sunday, ..., 6 is Saturday

        // Aggregate workouts into week keys (Sunday YYYY-MM-DD) and track day-of-week active set
        const weekWorkoutCounts = {};
        const weekDaysActive = {};

        for ( let i = 0; i < entries.length; ++i ) {
            const entryTime = entries[i].date instanceof Date ? entries[i].date.getTime() : new Date( entries[i].date ).getTime();
            const entryLocal = new Date( entryTime - offsetMs );
            const entrySunday = new Date( entryLocal );
            entrySunday.setUTCHours( 0, 0, 0, 0 );
            entrySunday.setUTCDate( entrySunday.getUTCDate() - entrySunday.getUTCDay() );

            const y = entrySunday.getUTCFullYear();
            const m = String( entrySunday.getUTCMonth() + 1 ).padStart( 2, "0" );
            const d = String( entrySunday.getUTCDate() ).padStart( 2, "0" );
            const weekKey = `${y}-${m}-${d}`;

            weekWorkoutCounts[weekKey] = ( weekWorkoutCounts[weekKey] || 0 ) + 1;

            if ( !weekDaysActive[weekKey] ) {
                weekDaysActive[weekKey] = new Set();
            }
            weekDaysActive[weekKey].add( entryLocal.getUTCDay() );
        }

        // Current week statistics
        const cy = currentSundayLocal.getUTCFullYear();
        const cm = String( currentSundayLocal.getUTCMonth() + 1 ).padStart( 2, "0" );
        const cd = String( currentSundayLocal.getUTCDate() ).padStart( 2, "0" );
        const currentWeekKey = `${cy}-${cm}-${cd}`;

        const thisWeekWorkouts = weekWorkoutCounts[currentWeekKey] || 0;
        const hasWorkedOutThisWeek = thisWeekWorkouts > 0;
        const currentWeekSet = weekDaysActive[currentWeekKey] || new Set();

        const daysActiveThisWeek = [];
        for ( let i = 0; i < 7; ++i ) {
            daysActiveThisWeek.push( currentWeekSet.has( i ) );
        }

        // Calculate consecutive weekly streak (weeks starting Sunday 12:00 AM)
        let currentStreak = 0;
        let isPending = false;

        if ( hasWorkedOutThisWeek ) {
            let checkSunday = new Date( currentSundayLocal );
            while ( currentStreak <= entries.length ) {
                const sy = checkSunday.getUTCFullYear();
                const sm = String( checkSunday.getUTCMonth() + 1 ).padStart( 2, "0" );
                const sd = String( checkSunday.getUTCDate() ).padStart( 2, "0" );
                const key = `${sy}-${sm}-${sd}`;

                if ( ( weekWorkoutCounts[key] || 0 ) > 0 ) {
                    ++currentStreak;
                    checkSunday.setUTCDate( checkSunday.getUTCDate() - 7 );
                } else {
                    break;
                }
            }
        } else {
            const prevSunday = new Date( currentSundayLocal );
            prevSunday.setUTCDate( prevSunday.getUTCDate() - 7 );

            const py = prevSunday.getUTCFullYear();
            const pm = String( prevSunday.getUTCMonth() + 1 ).padStart( 2, "0" );
            const pd = String( prevSunday.getUTCDate() ).padStart( 2, "0" );
            const prevKey = `${py}-${pm}-${pd}`;

            if ( ( weekWorkoutCounts[prevKey] || 0 ) > 0 ) {
                isPending = true;
                let checkSunday = prevSunday;
                while ( currentStreak <= entries.length ) {
                    const sy = checkSunday.getUTCFullYear();
                    const sm = String( checkSunday.getUTCMonth() + 1 ).padStart( 2, "0" );
                    const sd = String( checkSunday.getUTCDate() ).padStart( 2, "0" );
                    const key = `${sy}-${sm}-${sd}`;

                    if ( ( weekWorkoutCounts[key] || 0 ) > 0 ) {
                        ++currentStreak;
                        checkSunday.setUTCDate( checkSunday.getUTCDate() - 7 );
                    } else {
                        break;
                    }
                }
            } else {
                currentStreak = 0;
            }
        }

        // Calculate all-time longest weekly streak
        let longestStreak = currentStreak;
        const sortedWeekKeys = Object.keys( weekWorkoutCounts ).sort();

        if ( sortedWeekKeys.length > 0 ) {
            let run = 1;
            let maxRun = 1;

            for ( let i = 1; i < sortedWeekKeys.length; ++i ) {
                const [ y1, m1, d1 ] = sortedWeekKeys[i - 1].split( "-" ).map( Number );
                const [ y2, m2, d2 ] = sortedWeekKeys[i].split( "-" ).map( Number );
                const date1 = new Date( Date.UTC( y1, m1 - 1, d1 ) );
                const date2 = new Date( Date.UTC( y2, m2 - 1, d2 ) );
                const diffDays = Math.round( ( date2 - date1 ) / ( 1000 * 60 * 60 * 24 ) );

                if ( diffDays === 7 ) {
                    ++run;
                    if ( run > maxRun ) {
                        maxRun = run;
                    }
                } else {
                    run = 1;
                }
            }
            longestStreak = Math.max( currentStreak, maxRun );
        }

        const weekStartDate = new Date( currentSundayLocal.getTime() + offsetMs ).toISOString();

        return sendSuccess( res, {
            currentDayOfWeek,
            currentStreak,
            daysActiveThisWeek,
            hasWorkedOutThisWeek,
            isPending,
            longestStreak,
            thisWeekWorkouts,
            totalWorkouts: entries.length,
            weekStartDate
        });
    } catch ( err ) {
        console.error( "[Get Workout Streak Error]", err );
        return sendError( res, "Failed to retrieve workout streak metrics", "ERR_FETCH_STREAK_FAILED", 500 );
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
            include: WORKOUT_ENTRY_INCLUDE
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
    const { date, durationMinutes, name, notes, splitTag, status } = req.body || {};

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

        // Validate and update status
        if ( status !== undefined ) {
            if ( status !== "IN_PROGRESS" && status !== "COMPLETED" && status !== "CANCELED" ) {
                return sendError( res, "Status must be IN_PROGRESS, COMPLETED, or CANCELED", "ERR_INVALID_STATUS", 400 );
            }
            updateData.status = status;
            if ( status === "COMPLETED" && !existingEntry.completedAt ) {
                updateData.completedAt = new Date();
            }
        }

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
            data: updateData,
            include: WORKOUT_ENTRY_INCLUDE
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
            finalDuration = Math.max( 1, Math.min( Math.round( diffMs / ( 1000 * 60 ) ), 1440 ) );
        }

        const completedEntry = await prisma.workoutEntry.update({
            where: { id },
            data: {
                status: "COMPLETED",
                completedAt: validCompletedAt,
                durationMinutes: finalDuration
            },
            include: WORKOUT_ENTRY_INCLUDE
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
    const { date } = req.body || {};

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Workout entry not found", "ERR_ENTRY_NOT_FOUND", 404 );
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
        let workoutDate = now;
        if ( date ) {
            const parsedDate = new Date( date );
            if ( !Number.isNaN( parsedDate.getTime() ) ) {
                workoutDate = parsedDate;
            }
        }

        const clonedEntry = await prisma.$transaction( async ( tx ) => {
            // Enforce Single Active Workout Rule inside write transaction
            const existingActive = await tx.workoutEntry.findFirst({
                where: {
                    userId: req.user.id,
                    status: "IN_PROGRESS"
                },
                select: { id: true, name: true, startedAt: true }
            });

            if ( existingActive ) {
                const conflictErr = new Error( "An active workout is already in progress. Complete or finish it before cloning another session." );
                conflictErr.code = "ERR_ACTIVE_WORKOUT_EXISTS";
                conflictErr.status = 409;
                conflictErr.details = { activeWorkoutId: existingActive.id, activeWorkout: existingActive };
                throw conflictErr;
            }

            const newEntry = await tx.workoutEntry.create({
                data: {
                    userId: req.user.id,
                    routineId: sourceEntry.routineId,
                    name: sourceEntry.name,
                    splitTag: sourceEntry.splitTag,
                    notes: sourceEntry.notes,
                    status: "IN_PROGRESS",
                    date: workoutDate,
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
                include: WORKOUT_ENTRY_INCLUDE
            });
        });

        return sendSuccess( res, clonedEntry, 201 );
    } catch ( err ) {
        if ( err.code === "ERR_ACTIVE_WORKOUT_EXISTS" ) {
            return sendError( res, err.message, err.code, err.status || 409, err.details );
        }

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

