import { useEffect, useState } from 'react';
import useFeatureApi from 'hooks/api/actions/useFeatureApi/useFeatureApi';
import useQueryParams from 'hooks/useQueryParams';
import { useRequiredPathParam } from 'hooks/useRequiredPathParam';
import { formatUnknownError } from 'utils/formatUnknownError';

const useFeatureForm = (
    initialName = '',
    initialType = 'release',
    initialProject = 'default',
    initialDescription = '',
    initialImpressionData = false,
    initialEpic = ''
) => {
    const projectId = useRequiredPathParam('projectId');
    const params = useQueryParams();
    const { validateFeatureToggleName } = useFeatureApi();
    const toggleQueryName = params.get('name');
    const [type, setType] = useState(initialType);
    const [name, setName] = useState(toggleQueryName || initialName);
    const [project, setProject] = useState(projectId || initialProject);
    const [epic, setEpic] = useState(initialEpic);
    const [description, setDescription] = useState(initialDescription);
    const [impressionData, setImpressionData] = useState<boolean>(
        initialImpressionData
    );
    const [errors, setErrors] = useState({});

    useEffect(() => {
        setType(initialType);
    }, [initialType]);

    useEffect(() => {
        if (!name) {
            setName(toggleQueryName || initialName);
        }
    }, [name, initialName, toggleQueryName]);

    useEffect(() => {
        if (!projectId) setProject(initialProject);
        else setProject(projectId);
    }, [initialProject, projectId]);

    useEffect(() => {
        setEpic(initialEpic);
    }, [initialEpic]);

    useEffect(() => {
        setDescription(initialDescription);
    }, [initialDescription]);

    useEffect(() => {
        setImpressionData(initialImpressionData);
    }, [initialImpressionData]);

    const getTogglePayload = () => {
        return {
            type,
            name,
            description,
            impressionData,
            epic,
        };
    };

    const validateToggleName = async () => {
        if (name.length === 0) {
            setErrors(prev => ({ ...prev, name: 'Name can not be empty.' }));
            return false;
        }
        try {
            await validateFeatureToggleName(name);
            return true;
        } catch (error: unknown) {
            setErrors(prev => ({ ...prev, name: formatUnknownError(error) }));
            return false;
        }
    };

    const validateEpicName = () => {
        if (epic.length === 0) {
            setErrors(prev => ({ ...prev, epic: 'Epic can not be empty.' }));
            return false;
        }
    
        const startsWithLatinLetter = /^[a-zA-Z]/.test(epic);
        const hasLatinLetter = /[a-zA-Z]/.test(epic);
        const hasNumber = /\d/.test(epic);
        const hasHyphen = /-/.test(epic);

        if (!startsWithLatinLetter) {
            setErrors(prev => ({
                ...prev,
                epic: 'Epic must start with a Latin letter.'
            }));
            return false;
        }
    
        if (!hasLatinLetter || !hasNumber || !hasHyphen) {
            setErrors(prev => ({ 
                ...prev, 
                epic: 'Epic should include a Latin letter, a number, and a hyphen.'
            }));
            return false;
        }
    
        return true;
    }    

    const clearErrors = () => {
        setErrors({});
    };

    return {
        type,
        setType,
        name,
        setName,
        project,
        setProject,
        description,
        setDescription,
        epic,
        setEpic,
        impressionData,
        setImpressionData,
        getTogglePayload,
        validateToggleName,
        validateEpicName,
        clearErrors,
        errors,
    };
};

export default useFeatureForm;
