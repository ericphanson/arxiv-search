import {handler as WatchIncomingLambda} from './WatchIncomingLambda';
import {handler as WatchStatusLambda} from './WatchStatusLambda';
import {handler as ProcessWrapperLambda} from './ProcessWrapperLambda';
import {handler as UpdateStatusLambda} from './UpdateStatusLambda';
import {handler as BatchEditStatusTableLambda} from './BatchEditStatusTableLambda';
import {handler as ProcessFilesLambda} from './ProcessFilesLambda';
import { getClient } from "./es_connection";

export { WatchIncomingLambda, WatchStatusLambda, ProcessWrapperLambda, UpdateStatusLambda, BatchEditStatusTableLambda, ProcessFilesLambda, getClient };