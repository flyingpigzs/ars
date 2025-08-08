#!/usr/bin/env python3
# -*- coding: utf-8 -*-


import csv
import json
import sys
import os


# Globals
input_directory = "./csvt"
output_directory = "./json"
# -------------------------


def findChoices(question, fileName):
    with open(fileName, "r", encoding="utf-8", errors="replace") as oireetFile:
        reader = csv.reader(oireetFile)
        result = []
        for rowIndex, row in enumerate(reader):
            if rowIndex < question.rowIndex:
                continue
            prevCol = ''
            for colIndex, col in enumerate(row):
                if colIndex != (question.colIndex + 2):
                    prevCol = col
                    continue
                if prevCol != '' and rowIndex != question.rowIndex:
                    return result
                elif col != '':
                    newAnswer = Answer()
                    newAnswer.answerText['FI'] = col
                    newAnswer.printText['FI'] = row[colIndex + 1]
                    newAnswer.colIndex = colIndex
                    newAnswer.rowIndex = rowIndex
                    result.append(newAnswer)
                prevCol = col
    return result


def findAnswerToPushQuestion(result, question):
    stack = []
    possibleParents = []
    for item in result:
        stack.append(item)
    while stack:
        elm = stack.pop()
        if elm.type not in ['valinta', 'monivalinta']:
            if (elm.colIndex + 4) == question.colIndex and question.rowIndex == elm.rowIndex:
                return elm.answers[0].question
        for ans in elm.answers:
            if (question.colIndex - 2) == ans.colIndex and ans.rowIndex == question.rowIndex:
                return ans.question
            elif (question.colIndex - 2) == ans.colIndex and ans.rowIndex < question.rowIndex:
                possibleParents.append(ans)
            for q in ans.question:
                stack.append(q)
    if len(possibleParents) == 0:
        return result
    closestParent = None
    closestValue = 10000
    for ans in possibleParents:
        diff = question.rowIndex - ans.rowIndex
        if diff < closestValue:
            closestValue = diff
            closestParent = ans
    return closestParent.question


def deleteHelperProperties(result):
    stack = []
    for item in result:
        stack.append(item)
    while stack:
        elm = stack.pop()
        if hasattr(elm, 'rowIndex'):
            del elm.rowIndex
        if hasattr(elm, 'colIndex'):
            del elm.colIndex
        if hasattr(elm, 'depth'):
            del elm.depth
        for ans in elm.answers:
            if hasattr(ans, 'rowIndex'):
                del ans.rowIndex
            if hasattr(ans, 'colIndex'):
                del ans.colIndex
            for q in ans.question:
                stack.append(q)


def printResultAsJson(result, output_file):
    def custom_serializer(obj):
        if isinstance(obj, (Question, Answer)):
            return obj.__dict__
        raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

    deleteHelperProperties(result)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, default=custom_serializer, ensure_ascii=False, indent=4)


def printResultAsHumanReadable(result):
    stack = []
    for item in result:
        item.depth = 1
        stack.insert(0, item)
    prevCategory = None
    while stack:
        elm = stack.pop()
        if hasattr(elm, 'category') and prevCategory != elm.category['FI']:
            print(getIndentation(0) + elm.category['FI'])
            prevCategory = elm.category['FI']
        if hasattr(elm, 'answers'):
            print(getIndentation(elm.depth) + '' + elm.questionId + '. ' + elm.questionText['FI'] + ' (' + elm.type + ')')
            for ans in elm.answers[::-1]:
                ans.depth = elm.depth
                stack.append(ans)
        elif hasattr(elm, 'question'):
            if elm.answerText != '':
                print(getIndentation(elm.depth) + '  ' + elm.answerText['FI'] + ' (' + elm.printText['FI'] + ')')
            for q in elm.question[::-1]:
                q.depth = elm.depth + 1
                stack.append(q)


def getIndentation(depth):
    if depth < 1:
        return ''
    return ' ' * (depth * 4)


def isValidType(type_):
    validTypes = ['valinta', 'päivämäärä', 'vuosi', 'ligert', 'vapaateksti', 'numero', 'monivalinta', 'medication']
    return str(type_).lower() in validTypes


class Question:
    def toJSON(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=False, indent=4)

    def __init__(self):
        self.questionId = None
        self.questionText = {'FI': ''}
        self.category = {'categoryId': 1234, 'subcategoryId': 1, 'backgroundCategory': ''}
        self.type = None
        self.answers = []
        self.depth = 0
        self.rowIndex = 0
        self.colIndex = 0


class Answer:
    def toJSON(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=False, indent=4)

    def __init__(self):
        self.answerId = None
        self.printText = {'FI': ''}
        self.answerText = {'FI': ''}
        self.question = []
        self.rowIndex = 0
        self.colIndex = 0


def main():

    if not os.path.exists(output_directory):
        os.makedirs(output_directory)

    for file_name in os.listdir(input_directory):
        if file_name.endswith(".csv"):
            file_path = os.path.join(input_directory, file_name)
            output_file = os.path.join(output_directory, file_name.replace(".csv", ".json"))

            with open(file_path, "r", encoding="utf-8", errors="replace") as oireetFile:
                reader = csv.reader(oireetFile)
                result = []
                currentQuestion = None
                questionId = 1
                category = None
                hasErrors = False

                for rowIndex, row in enumerate(reader):
                    if rowIndex < 1:
                        continue
                    for colIndex, col in enumerate(row):
                        col = col.strip()
                        if colIndex == 0:
                            if col != '':
                                category = col
                            continue
                        else:
                            if ((colIndex - 1) % 4) == 0 and col != '':
                                currentQuestion = Question()
                                currentQuestion.rowIndex = rowIndex
                                currentQuestion.questionText['FI'] = col
                                currentQuestion.colIndex = colIndex
                                currentQuestion.questionId = str(questionId)
                                questionId += 1
                            elif ((colIndex - 1) % 4) == 1 and col != '' and currentQuestion is not None:
                                if isValidType(col):
                                    currentQuestion.type = str(col).lower()
                                else:
                                    hasErrors = True
                                    print(f"ERROR at: {rowIndex + 1},{colIndex + 1}, Invalid type '{col}'")
                            elif ((colIndex - 1) % 4) == 2 and currentQuestion is not None and currentQuestion.type is not None:
                                if currentQuestion.type.strip() in ['valinta', 'monivalinta']:
                                    answers = findChoices(currentQuestion, file_path)
                                    if len(answers) == 1:
                                        print(f"ERROR at: {rowIndex + 1},{colIndex + 1}, Only one choice given")
                                        hasErrors = True
                                    for indx, newAnswer in enumerate(answers):
                                        newAnswer.answerId = currentQuestion.questionId + '_' + str(indx + 1)
                                        currentQuestion.answers.append(newAnswer)
                                else:
                                    newAnswer = Answer()
                                    newAnswer.answerId = currentQuestion.questionId + '_1'
                                    newAnswer.printText['FI'] = row[colIndex + 1]
                                    newAnswer.answerText = ''
                                    currentQuestion.answers.append(newAnswer)
                                if colIndex < 4:
                                    result.append(currentQuestion)
                                else:
                                    ans = findAnswerToPushQuestion(result, currentQuestion)
                                    ans.append(currentQuestion)
                                currentQuestion = None
                            elif ((colIndex - 1) % 4) == 3 and currentQuestion is not None and currentQuestion.type is not None:
                                continue

            if not hasErrors:
                printResultAsJson(result, output_file)


if __name__ == "__main__":
    main()
