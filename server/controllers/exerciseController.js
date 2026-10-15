/******************************************************************************
 * Exercise Controller
 * Handles exercise catalog queries, filtering, and custom exercise lifecycle
 ******************************************************************************/

import prisma from "../models/db.js";
import { sendError, sendSuccess } from "../utils/response.js";

// Allowed exercise tracking modalities
const VALID_MODALITIES = new Set([
    "WEIGHT_REPS",
    "TIME_DURATION",
    "DISTANCE_TIME"
]);

// Used to normalize strings to Title Case (e.g. "chest" -> "Chest", "barbell" -> "Barbell")
const toTitleCase = ( str ) => {
    if ( !str || typeof str !== "string" ) return "";
    return str
        .trim()
        .replace( /\s+/g, " " )
        .toLowerCase()
        .replace( /(?:^|[\s\-])\w/g, ( match ) => match.toUpperCase() );
};

// Used to retrieve catalog exercises w/ filtering and search
export const getExercises = async ( req, res ) => {
    const { category, custom, equipment, limit, modality, offset, search, sortBy } = req.query;

    const where = {
        isArchived: false
    };

    // Filter by custom vs global catalog if explicitly requested
    if ( custom === "true" ) {
        where.isCustom = true;
        where.userId = req.user.id;
    } else if ( custom === "false" ) {
        where.isCustom = false;
    } else {
        where.OR = [
            { isCustom: false },
            { isCustom: true, userId: req.user.id }
        ];
    }

    // Filter by muscle category if provided (normalized to Title Case)
    if ( category && typeof category === "string" && category.trim() !== "" ) {
        where.category = toTitleCase( category );
    }

    // Filter by equipment type if provided (normalized to Title Case)
    if ( equipment && typeof equipment === "string" && equipment.trim() !== "" ) {
        where.equipment = toTitleCase( equipment );
    }

    // Filter by tracking modality if provided (normalized to uppercase)
    if ( modality && typeof modality === "string" && modality.trim() !== "" ) {
        where.modality = modality.trim().toUpperCase();
    }

    // Search by name substring (case-insensitive in SQLite, capped to 100 chars)
    if ( search && typeof search === "string" && search.trim() !== "" ) {
        where.name = {
            contains: search.trim().slice( 0, 100 )
        };
    }

    // Configure result ordering
    let orderBy = [ { name: "asc" } ];
    if ( sortBy === "category" ) {
        orderBy = [ { category: "asc" }, { name: "asc" } ];
    } else if ( sortBy === "equipment" ) {
        orderBy = [ { equipment: "asc" }, { name: "asc" } ];
    } else if ( sortBy === "modality" ) {
        orderBy = [ { modality: "asc" }, { name: "asc" } ];
    }

    const queryOptions = { where, orderBy };

    // Apply pagination if specified
    if ( limit !== undefined ) {
        const parsedLimit = parseInt( limit, 10 );
        if ( !Number.isNaN( parsedLimit ) && parsedLimit > 0 ) {
            queryOptions.take = Math.min( parsedLimit, 200 );
        }
    }

    if ( offset !== undefined ) {
        const parsedOffset = parseInt( offset, 10 );
        if ( !Number.isNaN( parsedOffset ) && parsedOffset >= 0 ) {
            queryOptions.skip = parsedOffset;
        }
    }

    try {
        const exercises = await prisma.exercise.findMany( queryOptions );

        return sendSuccess( res, exercises );
    } catch ( err ) {
        console.error( "[Get Exercises Error]", err );
        return sendError( res, "Failed to retrieve exercise catalog", "ERR_FETCH_EXERCISES_FAILED", 500 );
    }
};

// Used to retrieve single exercise by ID
export const getExerciseById = async ( req, res ) => {
    const { id } = req.params;
    const { includeArchived } = req.query;

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Exercise not found", "ERR_EXERCISE_NOT_FOUND", 404 );
    }

    const where = {
        id,
        OR: [
            { isCustom: false },
            { isCustom: true, userId: req.user.id }
        ]
    };

    if ( includeArchived !== "true" ) {
        where.isArchived = false;
    }

    try {
        const exercise = await prisma.exercise.findFirst({
            where
        });

        if ( !exercise ) {
            return sendError( res, "Exercise not found", "ERR_EXERCISE_NOT_FOUND", 404 );
        }

        return sendSuccess( res, exercise );
    } catch ( err ) {
        console.error( "[Get Exercise Error]", err );
        return sendError( res, "Failed to retrieve exercise", "ERR_FETCH_EXERCISE_FAILED", 500 );
    }
};

// Used to create new custom exercise for current user
export const createExercise = async ( req, res ) => {
    const { name, category, equipment, modality } = req.body || {};

    // Validate name
    if ( !name || typeof name !== "string" ) {
        return sendError( res, "Exercise name is required", "ERR_INVALID_NAME", 400 );
    }

    const trimmedName = name.trim().replace( /\s+/g, " " );
    if ( trimmedName.length < 2 || trimmedName.length > 50 ) {
        return sendError( res, "Exercise name must be between 2 and 50 characters", "ERR_INVALID_NAME", 400 );
    }

    // Validate category
    if ( !category || typeof category !== "string" ) {
        return sendError( res, "Exercise category is required", "ERR_INVALID_CATEGORY", 400 );
    }

    const normalizedCategory = toTitleCase( category );
    if ( normalizedCategory.length < 2 || normalizedCategory.length > 30 ) {
        return sendError( res, "Exercise category must be between 2 and 30 characters", "ERR_INVALID_CATEGORY", 400 );
    }

    // Validate equipment
    if ( !equipment || typeof equipment !== "string" ) {
        return sendError( res, "Exercise equipment is required", "ERR_INVALID_EQUIPMENT", 400 );
    }

    const normalizedEquipment = toTitleCase( equipment );
    if ( normalizedEquipment.length < 2 || normalizedEquipment.length > 30 ) {
        return sendError( res, "Exercise equipment must be between 2 and 30 characters", "ERR_INVALID_EQUIPMENT", 400 );
    }

    // Validate modality (defaults to WEIGHT_REPS if omitted)
    const normalizedModality = ( typeof modality === "string" && modality.trim() !== "" )
        ? modality.trim().toUpperCase()
        : ( modality === undefined ? "WEIGHT_REPS" : "" );

    if ( !VALID_MODALITIES.has( normalizedModality ) ) {
        return sendError( res, "Modality must be WEIGHT_REPS, TIME_DURATION, or DISTANCE_TIME", "ERR_INVALID_MODALITY", 400 );
    }

    try {
        // Verify case-insensitive name uniqueness within user active library
        const existing = await prisma.$queryRaw`
            SELECT id FROM "Exercise"
            WHERE LOWER(name) = LOWER(${trimmedName})
            AND isArchived = 0
            AND (isCustom = 0 OR userId = ${req.user.id})
            LIMIT 1;
        `;

        if ( existing.length > 0 ) {
            return sendError( res, "An exercise with this name already exists in your library", "ERR_EXERCISE_EXISTS", 409 );
        }

        const newExercise = await prisma.exercise.create({
            data: {
                name: trimmedName,
                category: normalizedCategory,
                equipment: normalizedEquipment,
                modality: normalizedModality,
                isCustom: true,
                isArchived: false,
                userId: req.user.id
            }
        });

        return sendSuccess( res, newExercise, 201 );
    } catch ( err ) {
        console.error( "[Create Exercise Error]", err );
        return sendError( res, "Failed to create custom exercise", "ERR_CREATE_EXERCISE_FAILED", 500 );
    }
};

// Used to update user custom exercise
export const updateExercise = async ( req, res ) => {
    const { id } = req.params;
    const { name, category, equipment, modality } = req.body || {};
    const updateData = {};

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Exercise not found", "ERR_EXERCISE_NOT_FOUND", 404 );
    }

    try {
        const exercise = await prisma.exercise.findUnique({
            where: { id }
        });

        if ( !exercise || exercise.isArchived ) {
            return sendError( res, "Exercise not found", "ERR_EXERCISE_NOT_FOUND", 404 );
        }

        // Prevent modification of global catalog movements
        if ( !exercise.isCustom ) {
            return sendError( res, "Global catalog exercises cannot be modified", "ERR_FORBIDDEN", 403 );
        }

        // Ensure user owns this custom exercise
        if ( exercise.userId !== req.user.id ) {
            return sendError( res, "You do not have permission to modify this exercise", "ERR_FORBIDDEN", 403 );
        }

        // Validate and update name if provided
        if ( name !== undefined ) {
            if ( typeof name !== "string" ) {
                return sendError( res, "Exercise name must be a string", "ERR_INVALID_NAME", 400 );
            }

            const trimmedName = name.trim().replace( /\s+/g, " " );
            if ( trimmedName.length < 2 || trimmedName.length > 50 ) {
                return sendError( res, "Exercise name must be between 2 and 50 characters", "ERR_INVALID_NAME", 400 );
            }

            if ( trimmedName.toLowerCase() !== exercise.name.toLowerCase() ) {
                const existing = await prisma.$queryRaw`
                    SELECT id FROM "Exercise"
                    WHERE LOWER(name) = LOWER(${trimmedName})
                    AND isArchived = 0
                    AND (isCustom = 0 OR userId = ${req.user.id})
                    AND id != ${id}
                    LIMIT 1;
                `;

                if ( existing.length > 0 ) {
                    return sendError( res, "An exercise with this name already exists in your library", "ERR_EXERCISE_EXISTS", 409 );
                }
            }

            updateData.name = trimmedName;
        }

        // Validate and update category if provided
        if ( category !== undefined ) {
            if ( typeof category !== "string" ) {
                return sendError( res, "Exercise category must be a string", "ERR_INVALID_CATEGORY", 400 );
            }

            const normalizedCategory = toTitleCase( category );
            if ( normalizedCategory.length < 2 || normalizedCategory.length > 30 ) {
                return sendError( res, "Exercise category must be between 2 and 30 characters", "ERR_INVALID_CATEGORY", 400 );
            }

            updateData.category = normalizedCategory;
        }

        // Validate and update equipment if provided
        if ( equipment !== undefined ) {
            if ( typeof equipment !== "string" ) {
                return sendError( res, "Exercise equipment must be a string", "ERR_INVALID_EQUIPMENT", 400 );
            }

            const normalizedEquipment = toTitleCase( equipment );
            if ( normalizedEquipment.length < 2 || normalizedEquipment.length > 30 ) {
                return sendError( res, "Exercise equipment must be between 2 and 30 characters", "ERR_INVALID_EQUIPMENT", 400 );
            }

            updateData.equipment = normalizedEquipment;
        }

        // Validate and update modality if provided
        if ( modality !== undefined ) {
            if ( typeof modality !== "string" ) {
                return sendError( res, "Modality must be a string", "ERR_INVALID_MODALITY", 400 );
            }

            const normalizedModality = modality.trim().toUpperCase();
            if ( !VALID_MODALITIES.has( normalizedModality ) ) {
                return sendError( res, "Modality must be WEIGHT_REPS, TIME_DURATION, or DISTANCE_TIME", "ERR_INVALID_MODALITY", 400 );
            }

            updateData.modality = normalizedModality;
        }

        if ( Object.keys( updateData ).length === 0 ) {
            return sendError( res, "No valid exercise fields provided for update", "ERR_NO_UPDATES", 400 );
        }

        const updated = await prisma.exercise.update({
            where: { id },
            data: updateData
        });

        return sendSuccess( res, updated );
    } catch ( err ) {
        console.error( "[Update Exercise Error]", err );
        return sendError( res, "Failed to update exercise", "ERR_UPDATE_EXERCISE_FAILED", 500 );
    }
};

// Used to soft-delete (archive) custom exercise preserving historical logs
export const deleteExercise = async ( req, res ) => {
    const { id } = req.params;

    if ( !id || typeof id !== "string" || id.length > 50 ) {
        return sendError( res, "Exercise not found", "ERR_EXERCISE_NOT_FOUND", 404 );
    }

    try {
        const exercise = await prisma.exercise.findUnique({
            where: { id }
        });

        if ( !exercise || exercise.isArchived ) {
            return sendError( res, "Exercise not found", "ERR_EXERCISE_NOT_FOUND", 404 );
        }

        // Prevent deletion of global catalog movements
        if ( !exercise.isCustom ) {
            return sendError( res, "Global catalog exercises cannot be deleted", "ERR_FORBIDDEN", 403 );
        }

        // Ensure user owns this custom exercise
        if ( exercise.userId !== req.user.id ) {
            return sendError( res, "You do not have permission to delete this exercise", "ERR_FORBIDDEN", 403 );
        }

        // Soft-delete to preserve historical workout entries and set logs
        await prisma.exercise.update({
            where: { id },
            data: { isArchived: true }
        });

        return sendSuccess( res, {
            message: "Exercise archived successfully",
            id
        });
    } catch ( err ) {
        console.error( "[Delete Exercise Error]", err );
        return sendError( res, "Failed to delete exercise", "ERR_DELETE_EXERCISE_FAILED", 500 );
    }
};

