/******************************************************************************
 * API Response Formatting Utilities
 * Standardized success and error envelope helpers
 ******************************************************************************/

// Used to send standard success JSON envelope
export const sendSuccess = ( res, data, statusCode = 200 ) => {
    return res.status( statusCode ).json({
        success: true,
        data
    });
};

// Used to send standard error JSON envelope
export const sendError = ( res, message, code = "ERR_BAD_REQUEST", statusCode = 400 ) => {
    return res.status( statusCode ).json({
        success: false,
        error: {
            code,
            message
        }
    });
};

