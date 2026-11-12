import { getCourse, type CourseId } from './registry';

export function selectedCourseId(): CourseId {
  if(typeof window === 'undefined') return 'algebra1';
  return new URLSearchParams(window.location.search).get('courseId') === 'geometry' ? 'geometry' : 'algebra1';
}
export function selectedCourse() { return getCourse(selectedCourseId()); }
export function courseFetch(input: string, init?: RequestInit) {
  const url = new URL(input, window.location.origin);
  if(url.origin === window.location.origin) url.searchParams.set('courseId', selectedCourseId());
  return fetch(url.toString(), init);
}
export function reportingRpcName(name: string) {
  if(selectedCourseId() !== 'geometry') return name;
  return name.startsWith('get_master_algebra1_') ? name.replace('algebra1','geometry') : name + '_geometry';
}
