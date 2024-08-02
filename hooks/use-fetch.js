import { useState } from "react";
import { toast } from "sonner";

//used for managing async operations like API calls in React components
const useFetch = (cb) => {                  //any async function can be passed as a callback
    const [data, setData] = useState(undefined);
    const [loading, setLoading] = useState(null);
    const [error, setError] = useState(null);

    const fn = async (...args) => {
        setLoading(true);    // loading is true when the function is called
        setError(null);       // Reset error state before making the request

        try {
            const response = await cb(...args);   // Call the cb function with the provided arguments
            setData(response);
            setError(null);
        } catch (error) {
            setError(error);
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };
    return {
        data,
        loading,
        error,
        fn,
        setData,  // Exposing setData to allow manual updates to data
    };  // returning the state and function
}

export default useFetch;