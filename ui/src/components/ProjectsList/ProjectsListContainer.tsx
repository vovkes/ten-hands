import { Classes, Icon, Tag, Tooltip } from "@blueprintjs/core";
import Axios from "axios";
import React from "react";
import {
    DragDropContext,
    Draggable,
    DraggableProvided,
    DragStart,
    Droppable,
    DroppableProvided,
    DroppableStateSnapshot,
    DropResult,
} from "react-beautiful-dnd";
import { useConfig } from "../shared/Config";
import { useJobs } from "../shared/Jobs";
import { useProjects } from "../shared/Projects";
import { useTheme } from "../shared/Themes";
import ProjectRunningTasksTag from "./ProjectRunningTasksTag";
import { Container, Item, TabSwitchAnimator } from "./styles";

interface IProjectsListContainerProps {}

const getRunningTasksCountForProjects = (projects: IProject[], runningTasks: any) => {
    const taskCount = {};

    projects.forEach((project: IProject) => {
        const { commands, _id } = project;
        let runningCount: number = 0;
        commands.forEach((command: IProjectCommand) => {
            const { _id } = command;
            if (runningTasks[_id]) {
                runningCount++;
            }
        });
        taskCount[_id!] = runningCount;
    });

    return taskCount;
};

const ProjectsListContainer: React.FC<IProjectsListContainerProps> = () => {
    const { projects: tempProjects, setActiveProject, activeProject } = useProjects();
    const { runningTasks } = useJobs();
    const { theme } = useTheme();
    const [selectedItemIndex, setSelectedItemIndex] = React.useState<number>(0);
    const [projects, setProjects] = React.useState<any>([]);
    const [activeProjectIndexBeforeDrag, setActiveProjectIndexBeforeDrag] = React.useState<number>(0);
    const [projectRunningTaskCount, setProjectRunningTaskCount] = React.useState<any>({});
    const { config } = useConfig();

    React.useEffect(() => {
        if (!tempProjects) {
            return;
        }

        setProjects(tempProjects);
    }, [tempProjects]);

    React.useEffect(() => {
        if (!projects) {
            return;
        }

        const taskCountMap = getRunningTasksCountForProjects(projects, runningTasks);

        setProjectRunningTaskCount(taskCountMap);
    }, [runningTasks, projects]);

    const changeActiveProject = React.useCallback(
        (projectId, index: number) => {
            const activeProjectWithId = projects.find(project => project._id === projectId);
            if (activeProjectWithId) {
                setActiveProject(activeProjectWithId);

                setSelectedItemIndex(index);
            } else {
                setActiveProject({
                    _id: "",
                    name: "",
                    type: "",
                    path: "",
                    commands: [],
                });
            }
        },
        [projects],
    );

    const saveNewProjectsOrder = React.useCallback(
        (projects: IProject[]) => {
            const save = async (projects: IProject[]) => {
                try {
                    console.info("Saving new projects order");
                    const projectIds = projects.map(project => project._id);
                    await Axios.post(`http://localhost:${config.port}/projects/reorder`, {
                        projectIds,
                    });
                    setProjects(projects);
                } catch (error) {
                    console.log("Error Reordering:", error);
                }
            };
            save(projects);
        },
        [projects],
    );

    const onDragStart = (result: DragStart) => {
        // Save Index of active project before.
        // So that, we can move animated blue background only if active project changed position.
        const newProjects = [...projects];
        const activeProjectIndex: number = newProjects.findIndex(x => x._id === activeProject._id);
        if (activeProjectIndex) {
            setActiveProjectIndexBeforeDrag(activeProjectIndex);
        }
    };

    const onDragEnd = (result: DropResult) => {
        const { destination, source } = result;
        if (!destination) {
            return;
        }

        if (destination.droppableId === source.droppableId && destination.index === source.index) {
            return;
        }

        const newProjects = [...projects];

        const sourceProject = newProjects[source.index];
        newProjects.splice(source.index, 1);
        newProjects.splice(destination.index, 0, sourceProject);

        setProjects(newProjects);
        saveNewProjectsOrder(newProjects);

        // Check if activeProject is moved
        const activeProjectIndexAfterDrag: number = newProjects.findIndex(x => x._id === activeProject._id);
        console.log("activeProjectIndexBeforeDrag:", activeProjectIndexBeforeDrag);
        console.log("activeProjectIndexAfterDrag:", activeProjectIndexAfterDrag);
        if (activeProjectIndexBeforeDrag !== activeProjectIndexAfterDrag) {
            setSelectedItemIndex(activeProjectIndexAfterDrag);
        }
    };

    if (projects.length === 0) {
        return <div />;
    }

    return (
        <>
            <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
                <Droppable droppableId={"project-list-droppable"}>
                    {(provided: DroppableProvided) => (
                        <Container ref={provided.innerRef} {...provided.droppableProps}>
                            <TabSwitchAnimator
                                style={{
                                    transform: `translateY(${selectedItemIndex * 40}px)`,
                                }}
                            />
                            {projects.map((project: IProject, index: number) => (
                                <Draggable draggableId={project._id!} index={index} key={project._id}>
                                    {(provided: DraggableProvided) => (
                                        <Item
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            onClick={() => changeActiveProject(project._id, index)}
                                            theme={theme}
                                            style={{
                                                ...provided.draggableProps.style,
                                                color:
                                                    activeProject._id === project._id
                                                        ? theme === Classes.DARK
                                                            ? "#48aff0"
                                                            : "#106ba3"
                                                        : "inherit",
                                            }}
                                        >
                                            {project.name}
                                            <div className="running-tasks-count" style={{ marginLeft: "auto" }}>
                                                <ProjectRunningTasksTag count={projectRunningTaskCount[project._id!]} />
                                            </div>
                                            <div className="drag-handle-container">
                                                <Icon icon="drag-handle-horizontal" />
                                            </div>
                                        </Item>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </Container>
                    )}
                </Droppable>
            </DragDropContext>
        </>
    );
};

export default ProjectsListContainer;
